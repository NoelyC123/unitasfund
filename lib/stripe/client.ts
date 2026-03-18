import type Stripe from "stripe";
import { stripe as singleton } from "../stripe";

export function getStripe(): Stripe {
  return singleton;
}

