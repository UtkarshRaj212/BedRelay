import { db } from "@/db";
import { dispatchActivities } from "@/db/schema";

export interface LogActivityParams {
  dispatchId: string;
  actorType: "DISPATCHER" | "HOSPITAL" | "SYSTEM";
  actorName?: string;
  action: string;
  details?: string;
  oldValue?: string;
  newValue?: string;
  note?: string;
}

export async function logDispatchActivity(
  params: LogActivityParams,
  tx?: any
): Promise<void> {
  const client = tx || db;
  const now = new Date();
  const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  await client.insert(dispatchActivities).values({
    id,
    dispatchId: params.dispatchId,
    timestamp: now,
    actorType: params.actorType,
    actorName: params.actorName || (params.actorType === "DISPATCHER" ? "Ambulance Dispatcher" : "Hospital Operations"),
    action: params.action,
    details: params.details || null,
    oldValue: params.oldValue || null,
    newValue: params.newValue || null,
    note: params.note || null,
    createdAt: now,
  });
}
