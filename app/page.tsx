import { redirect } from "next/navigation";

// The proxy sends logged-out visitors to /login. Replace with a landing page later.
export default function Home() {
  redirect("/dashboard");
}
