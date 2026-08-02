import { siteConfig } from "./seo";

export type EmailTemplateType = "prelaunch" | "launch" | "update";

interface TemplateResult {
  subject: string;
  html: string;
}

const BASE_STYLES = `
  font-family: 'Inter', sans-serif;
  max-width: 600px;
  margin: 0 auto;
  background-color: #ffffff;
  color: #1a1a1a;
  line-height: 1.6;
`;

const HEADER_STYLES = `
  text-align: center;
  padding: 20px 0;
  border-bottom: 1px solid #eaeaea;
`;

const CONTENT_STYLES = `
  padding: 30px 20px;
`;

const BUTTON_STYLES = `
  display: inline-block;
  background-color: #000000;
  color: #ffffff;
  padding: 12px 24px;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 600;
  margin-top: 20px;
`;

const FOOTER_STYLES = `
  text-align: center;
  padding: 20px;
  font-size: 12px;
  color: #666666;
  border-top: 1px solid #eaeaea;
`;

export function getPrelaunchTemplate(name: string): TemplateResult {
  return {
    subject: "Welcome to Blipko - Early Access Waitlist",
    html: `
      <div style="${BASE_STYLES}">
        <div style="${HEADER_STYLES}">
          <h2 style="margin: 0;">Blipko</h2>
        </div>
        <div style="${CONTENT_STYLES}">
          <h1 style="font-size: 24px; margin-bottom: 20px;">You're on the list, ${name}</h1>
          <p>Thanks for joining Blipko's early access. Blipko is a budget tracker you use by chatting — text a Telegram bot what you spent, in Malayalam, Manglish, Hindi or English, and it sorts every rupee into a 50/30/20 budget.</p>
          <p>We'll email you as soon as your spot opens up.</p>
        </div>
        <div style="${FOOTER_STYLES}">
          <p>&copy; ${new Date().getFullYear()} Blipko. All rights reserved.</p>
        </div>
      </div>
    `,
  };
}

export function getLaunchTemplate(name: string): TemplateResult {
  return {
    subject: "Blipko is Live! 🚀",
    html: `
      <div style="${BASE_STYLES}">
        <div style="${HEADER_STYLES}">
          <h2 style="margin: 0;">Blipko</h2>
        </div>
        <div style="${CONTENT_STYLES}">
          <h1 style="font-size: 24px; margin-bottom: 20px;">Welcome to Blipko, ${name}</h1>
          <p>Your account is ready. Blipko lives in Telegram: send it <strong>&ldquo;chai 30&rdquo;</strong> and it's logged, categorised, and counted against your budget — by text or voice note, in Malayalam, Manglish, Hindi or English.</p>
          <p>Open the dashboard to connect your Telegram account and set your monthly income. It takes about a minute.</p>

          <div style="text-align: center;">
            <a href="${siteConfig.url}/dashboard" style="${BUTTON_STYLES}">Open your dashboard</a>
          </div>
        </div>
        <div style="${FOOTER_STYLES}">
          <p>&copy; ${new Date().getFullYear()} Blipko. All rights reserved.</p>
        </div>
      </div>
    `,
  };
}

export function getUpdateTemplate(
  name: string,
  updateTitle: string,
  updateBody: string,
): TemplateResult {
  return {
    subject: `Update: ${updateTitle}`,
    html: `
      <div style="${BASE_STYLES}">
        <div style="${HEADER_STYLES}">
          <h2 style="margin: 0;">Blipko</h2>
        </div>
        <div style="${CONTENT_STYLES}">
          <h1 style="font-size: 24px; margin-bottom: 20px;">Hi ${name}, Here's What's New</h1>
          <h2 style="font-size: 18px; color: #333;">${updateTitle}</h2>
          <p>${updateBody}</p>

          <div style="text-align: center;">
            <a href="${siteConfig.url}/changelog" style="${BUTTON_STYLES}">See what's new</a>
          </div>
        </div>
        <div style="${FOOTER_STYLES}">
          <p>&copy; ${new Date().getFullYear()} Blipko. All rights reserved.</p>
        </div>
      </div>
    `,
  };
}
