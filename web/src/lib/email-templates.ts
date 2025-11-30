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
          <h1 style="font-size: 24px; margin-bottom: 20px;">Welcome to the Future of Bookkeeping, ${name}!</h1>
          <p>Thank you for joining our early access waitlist. We're building the ultimate AI-powered fintech chatbot for WhatsApp, designed to make bookkeeping "Zero-UI" and effortless.</p>
          
          <div style="margin: 30px 0; text-align: center;">
            <img src="https://placehold.co/600x300/png?text=Blipko+Dashboard+Preview" alt="Blipko Preview" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
          </div>

          <p>You are now in line to be among the first to experience Blipko. We will notify you as soon as your spot opens up.</p>
          <p>In the meantime, get ready to say goodbye to manual data entry!</p>
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
          <h1 style="font-size: 24px; margin-bottom: 20px;">The Wait is Over, ${name}!</h1>
          <p>We are thrilled to announce that Blipko is now officially <strong>LIVE</strong>!</p>
          <p>You can now start using Blipko on WhatsApp to manage your finances with just a text or a voice note.</p>

          <div style="margin: 30px 0; text-align: center;">
            <img src="https://placehold.co/600x300/png?text=Blipko+Live+Launch" alt="Blipko Live" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
          </div>

          <div style="text-align: center;">
            <a href="https://blipko.com/login" style="${BUTTON_STYLES}">Get Started Now</a>
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

          <div style="margin: 30px 0; text-align: center;">
             <img src="https://placehold.co/600x300/png?text=New+Features" alt="Update Visual" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
          </div>

          <div style="text-align: center;">
            <a href="https://blipko.com" style="${BUTTON_STYLES}">Check it Out</a>
          </div>
        </div>
        <div style="${FOOTER_STYLES}">
          <p>&copy; ${new Date().getFullYear()} Blipko. All rights reserved.</p>
        </div>
      </div>
    `,
  };
}
