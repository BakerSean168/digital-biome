import { defineMiddleware } from "astro:middleware";
import { readAuthFromCookies } from "./lib/auth";

export const onRequest = defineMiddleware((context, next) => {
  context.locals.auth = { isAuthed: readAuthFromCookies(context.cookies) };
  return next();
});
