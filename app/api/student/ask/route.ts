export const runtime = "nodejs";

function retired() {
  return Response.json(
    {
      error:
        "Student-facing KSI has been retired. Student records remain available to authorised teachers and school leadership for learning support.",
    },
    { status: 410 },
  );
}

export async function GET() {
  return retired();
}

export async function POST() {
  return retired();
}
