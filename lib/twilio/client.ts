import twilio from "twilio";

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN  || "";
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER || "";

export const twilioClient = twilio(ACCOUNT_SID, AUTH_TOKEN);
export { ACCOUNT_SID, AUTH_TOKEN, TWILIO_PHONE };

// Generate Twilio Video access token for a user in a room
export function generateVideoToken(identity: string, roomName: string): string {
  const { AccessToken } = twilio.jwt;
  const { VideoGrant } = AccessToken;
  const token = new AccessToken(ACCOUNT_SID, process.env.TWILIO_API_KEY || ACCOUNT_SID, process.env.TWILIO_API_SECRET || AUTH_TOKEN, { identity, ttl: 3600 });
  token.addGrant(new VideoGrant({ room: roomName }));
  return token.toJwt();
}
