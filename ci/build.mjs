// Corre en GitHub Actions: regenera la app con las correcciones guardadas desde el celular.
//
// fuente.bin        transcripción, curaduría, escaneos y generadores (cifrado)
// correcciones.bin  lo que se corrigió desde el panel (cifrado)
// La contraseña llega como secreto (FICHAS_PASS). Los logs de Actions son públicos: acá nunca se imprime
// ningún dato de las fichas, solo pasos y conteos. Los archivos descifrados quedan en una carpeta temporal
// del runner, que GitHub descarta al terminar.
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { pbkdf2Sync, createDecipheriv } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pw = process.env.FICHAS_PASS;
if (!pw) { console.error("Falta el secreto FICHAS_PASS"); process.exit(1); }
const estado = JSON.parse(readFileSync("estado.json", "utf8"));
const key = pbkdf2Sync(pw, Buffer.from(estado.salt, "hex"), 600000, 32, "sha256");

function open(file) {
  const b = readFileSync(file);
  const d = createDecipheriv("aes-256-gcm", key, b.subarray(16, 28));
  d.setAuthTag(b.subarray(-16));
  return Buffer.concat([d.update(b.subarray(28, -16)), d.final()]);
}
function run(label, cmd, args) {
  const p = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26 });
  if (p.status !== 0) { console.error(`✗ ${label} falló (código ${p.status}). Detalle omitido para no exponer datos.`); process.exit(1); }
  console.log(`✓ ${label}`);
  return p.stdout;
}

const tmp = mkdtempSync(join(tmpdir(), "fichas-"));
const src = join(tmp, "src"), out = join(tmp, "out");
mkdirSync(src); mkdirSync(out);
try {
  writeFileSync(join(tmp, "fuente.tgz"), open("fuente.bin"));
} catch {
  console.error("✗ No se pudo descifrar la fuente (¿el secreto FICHAS_PASS es la contraseña correcta?)");
  process.exit(1);
}
run("Extraer fuente", "tar", ["-xzf", join(tmp, "fuente.tgz"), "-C", src]);

if (existsSync("correcciones.bin")) {
  const corr = JSON.parse(gunzipSync(open("correcciones.bin")).toString("utf8"));
  writeFileSync(join(src, "correcciones.json"), JSON.stringify(corr));
  console.log(`✓ Correcciones: ${Object.keys(corr).filter((k) => !k.startsWith("_")).length} fichas`);
} else {
  console.log("✓ Sin correcciones todavía");
}

const res = run("Regenerar app", "python3", [join(src, "build.py"), join(src, "datos_crudos"), join(src, "escaneos"), out, join(src, "curado.json")]);
const resumen = res.trim().split("\n").pop();
if (/^\d+ fichas/.test(resumen)) console.log("  " + resumen.replace(/ · html.*$/, ""));
console.log("  " + run("Cifrar versión web", "node", [join(src, "build_web.mjs"), "--app", join(out, "Fichas_Mendoza2026.html"), "--out", ".",
  "--estado", "estado.json", "--panel", join(out, "panel_data.json"), "--escaneos", join(src, "escaneos"),
  "--repo", process.env.GITHUB_REPOSITORY || ""]).trim().split("\n").pop());
