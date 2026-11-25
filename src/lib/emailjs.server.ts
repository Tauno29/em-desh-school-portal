const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

export async function sendAdmissionsEmail(application: Record<string, string>) {
  const recipient = process.env["ADMISSIONS_RECIPIENT"] ?? "";
  if (!recipient) throw new Error("Admissions email recipient is not yet confirmed by the school.");
  const serviceId = process.env["EMAILJS_SERVICE_ID"] ?? "";
  const templateId = process.env["EMAILJS_TEMPLATE_ID"] ?? "";
  const publicKey = process.env["EMAILJS_PUBLIC_KEY"] ?? "";
  const privateKey = process.env["EMAILJS_PRIVATE_KEY"] ?? "";
  if (!serviceId || !templateId || !publicKey || !privateKey) throw new Error("Online applications are not fully set up yet. Please contact the school directly.");
  const guardianEmail = application["guardian_email"]?.trim() ?? "";
  const response = await fetch(EMAILJS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: { ...application, email: guardianEmail, guardian_email: guardianEmail, reply_to: guardianEmail, from_name: "Em-Desh English Medium Private School Admissions", to_email: recipient, submitted_at: new Date().toLocaleString() },
    }),
  });
  if (!response.ok) {
    console.error("[emailjs]", response.status, (await response.text()).slice(0, 240));
    throw new Error("The application could not be sent right now. Please try again or contact the school.");
  }
  return { recipient };
}
