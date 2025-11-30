import { Resend } from "resend";
import {
  EmailTemplateType,
  getPrelaunchTemplate,
  getLaunchTemplate,
  getUpdateTemplate,
} from "./email-templates";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailOptions {
  email: string;
  name: string;
  templateType?: EmailTemplateType;
  updateTitle?: string;
  updateBody?: string;
}

export async function sendWelcomeEmail(
  email: string,
  name: string,
  templateType: EmailTemplateType = "prelaunch",
) {
  return sendEmail({ email, name, templateType });
}

export async function sendEmail({
  email,
  name,
  templateType = "prelaunch",
  updateTitle = "",
  updateBody = "",
}: SendEmailOptions) {
  try {
    let template;

    switch (templateType) {
      case "launch":
        template = getLaunchTemplate(name);
        break;
      case "update":
        template = getUpdateTemplate(name, updateTitle, updateBody);
        break;
      case "prelaunch":
      default:
        template = getPrelaunchTemplate(name);
        break;
    }

    await resend.emails.send({
      from: "Blipko <onboarding@resend.dev>", // Update this with your verified domain in production
      to: email,
      subject: template.subject,
      html: template.html,
    });
    console.log(`Email (${templateType}) sent to ${email}`);
  } catch (error) {
    console.error("Error sending email:", error);
    // Don't throw, just log. We don't want to block sign-in if email fails.
  }
}
