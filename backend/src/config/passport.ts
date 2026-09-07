import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env } from "./env";
import { upsertUserByGoogleId, getUserById } from "../db/users";
import { User } from "../types";

export function configurePassport(): void {
  passport.serializeUser((user: Express.User, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await getUserById(id);
      done(null, user ?? false);
    } catch (err) {
      done(err as Error);
    }
  });

  if (!env.googleClientId || !env.googleClientSecret) {
    console.warn("[auth] GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set — Google login is disabled until configured");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.googleClientId,
        clientSecret: env.googleClientSecret,
        callbackURL: env.googleCallbackUrl,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value ?? "";
          const avatarUrl = profile.photos?.[0]?.value ?? null;
          const user = await upsertUserByGoogleId({
            google_id: profile.id,
            name: profile.displayName,
            email,
            avatar_url: avatarUrl,
          });
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}
