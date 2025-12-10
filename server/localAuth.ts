import bcrypt from "bcrypt";
import { Strategy as LocalStrategy } from "passport-local";
import passport from "passport";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import { z } from "zod";

const SALT_ROUNDS = 10;

export const registerSchema = z.object({
  username: z.string().min(3).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function setupLocalAuth(app: Express) {
  passport.use(
    "local",
    new LocalStrategy(
      {
        usernameField: "username",
        passwordField: "password",
      },
      async (username, password, done) => {
        try {
          const user = await storage.getUserByUsername(username);
          if (!user) {
            return done(null, false, { message: "Invalid username or password" });
          }
          if (!user.password) {
            return done(null, false, { message: "This account uses Replit Auth" });
          }
          if (!user.isActive) {
            return done(null, false, { message: "Account is disabled" });
          }
          const isValid = await comparePassword(password, user.password);
          if (!isValid) {
            return done(null, false, { message: "Invalid username or password" });
          }
          return done(null, {
            claims: { sub: user.id },
            expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
            authType: "local",
          });
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await hashPassword(data.password);
      
      const user = await storage.createLocalUser({
        username: data.username,
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
      });

      req.login(
        {
          claims: { sub: user.id },
          expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
          authType: "local",
        },
        (err) => {
          if (err) {
            return res.status(500).json({ message: "Login failed after registration" });
          }
          const { password: _, ...safeUser } = user;
          res.json({ message: "Registration successful", user: safeUser });
        }
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    try {
      loginSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Login failed" });
        }
        res.json({ message: "Login successful" });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.json({ message: "Logged out successfully" });
      });
    });
  });
}

export const isAuthenticatedLocal: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (user.authType === "local") {
    const now = Math.floor(Date.now() / 1000);
    if (now > user.expires_at) {
      return res.status(401).json({ message: "Session expired" });
    }
    return next();
  }

  if (!user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
};
