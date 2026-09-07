import { User as AppUser } from "./index";

declare global {
  namespace Express {
    interface User extends AppUser {}
  }
}

export {};
