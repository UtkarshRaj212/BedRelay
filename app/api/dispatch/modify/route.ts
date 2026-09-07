import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dispatchRequests, bedCategories, hospitals } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  resolveServerDispatcherSession,
  ACTIVE_STATUSES,
} from "@/lib/dispatcher-server";
import { evaluateConditionChange } from "@/lib/condition-similarity";
import { logDispatchActivity } from "@/lib/activity-logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest) {
  try {
    const { sessionId, applyCookie } = resolveServerDispatcherSession(req);
    const body = await req.json();

    const {
      etaMinutes,
      patientCondition,
      requestedBeds,
      bedCategoryCode,
      ambulanceUnit,
      ambulanceId,
      patientRef,
      patientReference,
    } = body;

    // Locate active request strictly for this session
    const [current] = await db
      .select()
      .from(dispatchRequests)
      .where(
        and(
          eq(dispatchRequests.dispatcherSessionId, sessionId),
          inArray(dispatchRequests.status, [...ACTIVE_STATUSES])
        )
      )
      .limit(1);

    if (!current) {
      return NextResponse.json(
        { error: "No active dispatch request found to modify." },
        { status: 404 }
      );
    }

    const now = new Date();

    // Field normalization & empty-field fallback (Requirement 2)
    const parsedEta =
      etaMinutes !== undefined && etaMinutes !== null && etaMinutes !== "" && !isNaN(Number(etaMinutes))
        ? Math.max(1, Number(etaMinutes))
        : current.etaMinutes;

    const parsedBeds =
      requestedBeds !== undefined && requestedBeds !== null && requestedBeds !== "" && !isNaN(Number(requestedBeds))
        ? Math.max(1, Number(requestedBeds))
        : current.requestedBeds;

    const trimmedCondition =
      patientCondition !== undefined && patientCondition !== null && String(patientCondition).trim() !== ""
        ? String(patientCondition).trim()
        : current.patientCondition;

    const upperCategory =
      bedCategoryCode !== undefined && bedCategoryCode !== null && String(bedCategoryCode).trim() !== ""
        ? String(bedCategoryCode).trim().toUpperCase()
        : current.bedCategoryCode.toUpperCase();

    const result = await db.transaction(async (tx) => {
      let nextEta = current.etaMinutes;
      let nextCondition = current.patientCondition;
      let nextCategory = current.bedCategoryCode;
      let nextRequestedBeds = current.requestedBeds;
      let nextApprovedBeds = current.approvedBeds;
      let nextReviewRequired = current.reviewRequired;
      const reviewReasons: string[] = [];

      const isAccepted = current.status.toUpperCase() === "ACCEPTED";
      const isCategoryChanged = upperCategory !== current.bedCategoryCode.toUpperCase();

      // 1. Validate Target Bed Category & Real Hospital Availability (Requirement 3)
      const [targetCat] = await tx
        .select()
        .from(bedCategories)
        .where(
          and(
            eq(bedCategories.hospitalId, current.hospitalId),
            eq(bedCategories.categoryCode, upperCategory)
          )
        )
        .for("update")
        .limit(1);

      if (!targetCat) {
        throw new Error(`Bed category '${upperCategory}' does not exist for this hospital facility.`);
      }

      // Calculate max allowed beds for this category
      // If category didn't change and request was accepted, previously approved beds can be re-allocated
      const maxAllowedBeds = (!isCategoryChanged && isAccepted)
        ? targetCat.availableBeds + (current.approvedBeds || 0)
        : targetCat.availableBeds;

      if (parsedBeds > maxAllowedBeds) {
        throw new Error(
          `Requested bed count (${parsedBeds}) exceeds maximum available capacity (${maxAllowedBeds}) for ${upperCategory}.`
        );
      }

      // 2. Bed Category Change (Requirement 4)
      if (isCategoryChanged) {
        nextCategory = upperCategory;
        nextRequestedBeds = parsedBeds;

        // If previously accepted, release previously approved beds back to the old category
        if (isAccepted && (current.approvedBeds || 0) > 0) {
          const [oldCat] = await tx
            .select()
            .from(bedCategories)
            .where(
              and(
                eq(bedCategories.hospitalId, current.hospitalId),
                eq(bedCategories.categoryCode, current.bedCategoryCode.toUpperCase())
              )
            )
            .for("update")
            .limit(1);

          if (oldCat) {
            await tx
              .update(bedCategories)
              .set({
                availableBeds: Math.min(oldCat.totalBeds, oldCat.availableBeds + current.approvedBeds),
                occupiedBeds: Math.max(0, oldCat.occupiedBeds - current.approvedBeds),
                lastUpdated: now,
                updatedAt: now,
              })
              .where(eq(bedCategories.id, oldCat.id));
          }
        }

        // Category changed: approved beds reset to 0 for new category (pending hospital review)
        nextApprovedBeds = 0;
        if (isAccepted) {
          nextReviewRequired = true;
          reviewReasons.push(
            `Bed category changed from ${current.bedCategoryCode} to ${upperCategory} (${parsedBeds} beds pending review)`
          );
        }

        await logDispatchActivity(
          {
            dispatchId: current.id,
            actorType: "DISPATCHER",
            action: "CATEGORY_CHANGED",
            details: `Required bed category changed from ${current.bedCategoryCode} to ${upperCategory} (Requested: ${parsedBeds}, Approved: 0)`,
            oldValue: `${current.bedCategoryCode} (approved: ${current.approvedBeds})`,
            newValue: `${upperCategory} (approved: 0)`,
            note: isAccepted ? "Hospital review required" : undefined,
          },
          tx
        );
      } else {
        // Same category: handle bed count changes (Requirement 4)
        if (parsedBeds !== current.requestedBeds) {
          if (isAccepted) {
            nextRequestedBeds = parsedBeds;
            if (parsedBeds < (current.approvedBeds || 0)) {
              // Reduction below approved: immediately reduce approved beds and release capacity
              const diff = (current.approvedBeds || 0) - parsedBeds;
              nextApprovedBeds = parsedBeds;
              nextReviewRequired = false;

              await tx
                .update(bedCategories)
                .set({
                  availableBeds: Math.min(targetCat.totalBeds, targetCat.availableBeds + diff),
                  occupiedBeds: Math.max(0, targetCat.occupiedBeds - diff),
                  lastUpdated: now,
                  updatedAt: now,
                })
                .where(eq(bedCategories.id, targetCat.id));

              await logDispatchActivity(
                {
                  dispatchId: current.id,
                  actorType: "DISPATCHER",
                  action: "BEDS_REDUCED",
                  details: `Requested beds reduced from ${current.requestedBeds} to ${parsedBeds}. Approved beds updated to ${parsedBeds}.`,
                  oldValue: `${current.requestedBeds} (approved: ${current.approvedBeds})`,
                  newValue: `${parsedBeds} (approved: ${parsedBeds})`,
                },
                tx
              );
            } else if (parsedBeds === (current.approvedBeds || 0)) {
              // Reduced back to approved count: no more pending review beds
              nextApprovedBeds = current.approvedBeds;
              nextReviewRequired = false;

              await logDispatchActivity(
                {
                  dispatchId: current.id,
                  actorType: "DISPATCHER",
                  action: "BEDS_REDUCED",
                  details: `Requested beds reduced from ${current.requestedBeds} to ${parsedBeds}.`,
                  oldValue: `${current.requestedBeds}`,
                  newValue: `${parsedBeds}`,
                },
                tx
              );
            } else {
              // Increase: approved beds stay the same, additional beds marked pending
              const additionalPending = parsedBeds - (current.approvedBeds || 0);
              nextRequestedBeds = parsedBeds;
              nextReviewRequired = true;
              reviewReasons.push(`+${additionalPending} additional bed(s) pending hospital review`);

              await logDispatchActivity(
                {
                  dispatchId: current.id,
                  actorType: "DISPATCHER",
                  action: "BEDS_INCREASED",
                  details: `Requested beds increased from ${current.requestedBeds} to ${parsedBeds} (+${additionalPending} pending approval).`,
                  oldValue: `${current.requestedBeds}`,
                  newValue: `${parsedBeds}`,
                  note: `+${additionalPending} pending approval`,
                },
                tx
              );
            }
          } else {
            // PENDING state: update requested beds
            nextRequestedBeds = parsedBeds;
            nextApprovedBeds = 0;
            await logDispatchActivity(
              {
                dispatchId: current.id,
                actorType: "DISPATCHER",
                action: "BEDS_UPDATED",
                details: `Requested beds updated from ${current.requestedBeds} to ${parsedBeds}`,
                oldValue: `${current.requestedBeds}`,
                newValue: `${parsedBeds}`,
              },
              tx
            );
          }
        }
      }

      // Enforce server-side invariant: approvedBeds must never exceed requestedBeds
      if (nextApprovedBeds > nextRequestedBeds) {
        nextApprovedBeds = nextRequestedBeds;
      }

      // 3. ETA Update
      if (parsedEta !== current.etaMinutes) {
        nextEta = parsedEta;
        await logDispatchActivity(
          {
            dispatchId: current.id,
            actorType: "DISPATCHER",
            action: "ETA_UPDATED",
            details: `ETA duration updated from ${current.etaMinutes}m to ${parsedEta}m`,
            oldValue: `${current.etaMinutes}m`,
            newValue: `${parsedEta}m`,
          },
          tx
        );
      }

      // 4. Patient Condition Update
      if (trimmedCondition !== current.patientCondition) {
        const evalResult = evaluateConditionChange(current.patientCondition, trimmedCondition);
        nextCondition = trimmedCondition;

        if (evalResult.isMaterialChange) {
          if (isAccepted) {
            nextReviewRequired = true;
            reviewReasons.push(evalResult.reason || "Patient condition changed materially.");
          }
          await logDispatchActivity(
            {
              dispatchId: current.id,
              actorType: "DISPATCHER",
              action: "CONDITION_CHANGED",
              details: `Patient condition updated: ${current.patientCondition} → ${trimmedCondition}`,
              oldValue: current.patientCondition,
              newValue: trimmedCondition,
              note: isAccepted ? "Hospital review required" : undefined,
            },
            tx
          );
        } else {
          await logDispatchActivity(
            {
              dispatchId: current.id,
              actorType: "DISPATCHER",
              action: "CONDITION_UPDATED",
              details: `Patient condition note updated: ${trimmedCondition}`,
              oldValue: current.patientCondition,
              newValue: trimmedCondition,
            },
            tx
          );
        }
      }

      // 5. Vehicle / Patient Identifier Updates
      const finalUnit = (ambulanceUnit || ambulanceId || "").trim();
      const finalRef = (patientRef || patientReference || "").trim();

      if (finalUnit && finalUnit !== current.ambulanceUnit) {
        await logDispatchActivity(
          {
            dispatchId: current.id,
            actorType: "DISPATCHER",
            action: "AMBULANCE_UPDATED",
            details: `Ambulance unit updated from ${current.ambulanceUnit} to ${finalUnit}`,
            oldValue: current.ambulanceUnit,
            newValue: finalUnit,
          },
          tx
        );
      }

      if (finalRef && finalRef !== current.patientRef) {
        await logDispatchActivity(
          {
            dispatchId: current.id,
            actorType: "DISPATCHER",
            action: "PATIENT_REF_UPDATED",
            details: `Patient reference updated to ${finalRef}`,
            oldValue: current.patientRef || "",
            newValue: finalRef,
          },
          tx
        );
      }

      const combinedReviewReason = reviewReasons.length > 0
        ? reviewReasons.join("; ")
        : current.reviewReason;

      await logDispatchActivity(
        {
          dispatchId: current.id,
          actorType: "DISPATCHER",
          action: "REQUEST_MODIFIED",
          details: `Dispatch request modified: beds=${nextRequestedBeds} (${nextCategory}), ETA=${nextEta}m.`,
          oldValue: JSON.stringify({
            beds: current.requestedBeds,
            category: current.bedCategoryCode,
            eta: current.etaMinutes,
          }),
          newValue: JSON.stringify({
            beds: nextRequestedBeds,
            category: nextCategory,
            eta: nextEta,
          }),
        },
        tx
      );

      const [updated] = await tx
        .update(dispatchRequests)
        .set({
          etaMinutes: nextEta,
          patientCondition: nextCondition,
          bedCategoryCode: nextCategory,
          requestedBeds: nextRequestedBeds,
          approvedBeds: nextApprovedBeds,
          reviewRequired: nextReviewRequired,
          reviewReason: combinedReviewReason,
          ambulanceUnit: finalUnit || current.ambulanceUnit,
          ambulanceId: finalUnit || current.ambulanceId || current.ambulanceUnit,
          patientRef: finalRef || current.patientRef,
          patientReference: finalRef || current.patientReference || current.patientRef,
          updatedAt: now,
        })
        .where(eq(dispatchRequests.id, current.id))
        .returning();

      return updated;
    });

    const res = NextResponse.json(
      {
        success: true,
        message: "Dispatch request modified successfully.",
        dispatch: result,
        reviewRequired: Boolean(result.reviewRequired),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );

    applyCookie(res);
    return res;
  } catch (error: any) {
    console.error("Failed to modify dispatch request:", error);
    return NextResponse.json(
      { error: error.message || "Failed to modify dispatch request" },
      { status: 500 }
    );
  }
}
