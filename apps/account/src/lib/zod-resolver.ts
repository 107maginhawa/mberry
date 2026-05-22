/**
 * Type-safe wrapper for zodResolver that handles the Zod v4 / @hookform/resolvers
 * type incompatibility. Zod v4 schemas have `_zod.version.minor = 4` while
 * @hookform/resolvers v3 expects Zod v3 types. This wrapper centralises the
 * necessary type cast to a single location.
 */
import { zodResolver as _zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { ZodTypeAny } from "zod";

export function zodResolver<T extends FieldValues>(
	schema: ZodTypeAny,
	// biome-ignore lint/suspicious/noExplicitAny: Zod v4 / @hookform/resolvers type mismatch — intentional boundary cast
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Resolver<T, any> {
	// biome-ignore lint/suspicious/noExplicitAny: Zod v4 / @hookform/resolvers type mismatch — intentional boundary cast
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return _zodResolver(schema as any) as Resolver<T, any>;
}
