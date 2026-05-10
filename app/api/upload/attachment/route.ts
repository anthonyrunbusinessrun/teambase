import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED = [
  "image/jpeg","image/png","image/webp","image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain","text/csv",
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    if (!files.length) return NextResponse.json({ error: "No files provided" }, { status: 400 });

    const attachments = [];
    for (const file of files) {
      if (file.size > MAX_SIZE) return NextResponse.json({ error: `${file.name} exceeds 10MB limit` }, { status: 413 });
      if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: `${file.name}: unsupported file type` }, { status: 400 });

      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const dataUrl = `data:${file.type};base64,${base64}`;

      attachments.push({
        name: file.name,
        type: file.type,
        size: formatSize(file.size),
        url: dataUrl,
        isImage: file.type.startsWith("image/"),
        isPdf: file.type === "application/pdf",
        isDoc: file.type.includes("word") || file.type.includes("document"),
      });
    }

    return NextResponse.json({ ok: true, attachments });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
