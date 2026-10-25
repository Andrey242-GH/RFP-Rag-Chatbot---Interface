import { redirect } from "next/navigation";

// Root redirects to the Upload page as the entry point of the platform
export default function Home() {
  redirect("/upload");
}
