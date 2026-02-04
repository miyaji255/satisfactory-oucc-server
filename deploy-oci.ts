import { $ } from "bun";

// Read oci-config.json
const ociConfig = await Bun.file("oci-config.json").json();
const { compartmentId, availabilityDomain, subnetId } = ociConfig;

// Read containers.json
const containers = await Bun.file("containers.json").json();
const envVars = containers[0].environmentVariables;

if (envVars.TS_AUTH_KEY === "YOUR_TAILSCALE_AUTH_KEY" || envVars.SATISFACTORY_BOT_DISCORD_TOKEN === "YOUR_DISCORD_BOT_TOKEN") {
  console.error("Error: Please set your tokens in containers.json");
  console.error("  cp containers.json.sample containers.json");
  console.error("  nano containers.json  # Edit with your tokens");
  process.exit(1);
}

// Update vnics.json with subnetId from oci-config.json
const vnics = [{ displayName: "satisfactory-vnic", subnetId, isPublicIpAssigned: true }];
await Bun.write("vnics.json", JSON.stringify(vnics, null, 2));

console.log("Creating Container Instance...");

await $`oci container-instances container-instance create --auth security_token --compartment-id ${compartmentId} --availability-domain ${availabilityDomain} --shape CI.Standard.A1.Flex --shape-config '{"memoryInGBs": 6.0, "ocpus": 1.0}' --containers file://containers.json --vnics file://vnics.json --display-name satisfactory-server --wait-for-state SUCCEEDED`;

console.log("Container Instance created!");
console.log("Check status: bun run status-oci.ts");
