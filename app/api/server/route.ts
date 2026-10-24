import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
    return NextResponse.json({
        instance: process.env.INSTANCE_NAME,
        hostname: os.hostname(),
        timestamp: new Date().toISOString(),
    });
}