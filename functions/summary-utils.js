"use strict";

function localizedText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);
  if (typeof value.text === "string") return value.text;
  if (value.text && typeof value.text === "object") return localizedText(value.text);
  if (value.overview) return localizedText(value.overview);
  return "";
}

module.exports = { localizedText };
