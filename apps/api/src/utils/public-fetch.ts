import dns from "node:dns";
import type { LookupFunction } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import {
  isDisallowedAddress,
  privateDestinationsAllowed,
} from "./assert-public-destination";

// Checks the addresses each socket actually connects to. A preflight DNS check
// alone lets a hostname re-resolve to a private address (DNS rebinding).
const publicLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(
    hostname,
    { family: options.family, hints: options.hints, all: true, verbatim: true },
    (error, addresses) => {
      if (error) return callback(error, []);
      if (
        !privateDestinationsAllowed() &&
        addresses.some(({ address }) => isDisallowedAddress(address))
      ) {
        return callback(
          new Error("Destination resolves to a non-routable address"),
          [],
        );
      }

      const [first] = addresses;
      if (!first) {
        return callback(new Error(`Could not resolve ${hostname}`), []);
      }
      if (options.all) return callback(null, addresses);
      callback(null, first.address, first.family);
    },
  );
};

const publicAgent = new Agent({ connect: { lookup: publicLookup } });

// fetch for user-supplied destinations (webhooks, notification servers,
// self-hosted Gitea). Redirects are not followed: a public host could
// otherwise bounce the request to an internal service.
export async function publicFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await undiciFetch(url, {
    ...(init as Parameters<typeof undiciFetch>[1]),
    redirect: "manual",
    dispatcher: publicAgent,
  });
  return response as unknown as Response;
}
