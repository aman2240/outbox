import { Router } from "express";
import passport from "passport";
import { env } from "../config/env";

export const authRouter = Router();

authRouter.get("/google", (req, res, next) => {
  if (!env.googleClientId || !env.googleClientSecret) {
    res.status(501).json({ error: "Google OAuth is not configured on this server" });
    return;
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

authRouter.get(
  "/google/callback",
  (req, res, next) => {
    if (!env.googleClientId || !env.googleClientSecret) {
      res.redirect(`${env.frontendUrl}/login?error=oauth_not_configured`);
      return;
    }
    next();
  },
  passport.authenticate("google", { failureRedirect: `${env.frontendUrl}/login?error=oauth_failed` }),
  (_req, res) => {
    res.redirect(`${env.frontendUrl}/dashboard`);
  }
);

authRouter.get("/me", (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ user: req.user });
});

authRouter.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      next(err);
      return;
    }
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });
});
