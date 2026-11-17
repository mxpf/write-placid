import { Studio } from "./Studio";

export const dynamic = "force-dynamic";

export default function Home() {
  const publishingEnabled = process.env.WRITE_PLACID_STUDIO_D1_PREVIEW !== "1"
    || (process.env.WRITE_PLACID_PUBLIC_CONTRACT_VERSION === "1"
      && Boolean(process.env.WRITE_PLACID_GITHUB_TOKEN?.trim()));
  return <Studio publishingEnabled={publishingEnabled} />;
}
