import { input } from "@inquirer/prompts";

import { setAuthTokens } from "../utils/auth";

export default async function login() {
  console.log("Enter the email address of your Crawlspace account.");
  console.log("A one-time passcode will be emailed to this address.");
  console.log(
    "If you do not have an account yet, sign up at https://crawlspace.dev",
  );

  const email = await input({ message: "Email address:", required: true });
  console.log(`Sending one-time passcode to ${email}...`);

  try {
    const response = await fetch("https://api.crawlspace.dev/v1/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      console.error(error.message);
      return;
    }
  } catch (error) {
    console.error("Could not request one-time passcode", error);
    return;
  }

  console.log(`Sent. Paste in the code you received below.`);
  const code = await input({ message: "Passcode:", required: true });

  console.log(`Validating passcode...`);
  let session;
  try {
    const response = await fetch("https://api.crawlspace.dev/v1/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    if (!response.ok) {
      const { error } = await response.json();
      console.error(error.message);
      return;
    }
    session = await response.json();
  } catch (error) {
    console.error("Could not verify one-time passcode", error);
    return;
  }

  const decodedJwt = setAuthTokens(session);
  if (decodedJwt.email) {
    console.log(`Logged in as ${decodedJwt.email}`);
  } else {
    console.error("Email address not found");
  }
}
