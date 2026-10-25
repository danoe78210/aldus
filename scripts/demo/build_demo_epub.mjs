import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), "manuscrit-demo.epub");

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let bit = 0; bit < 8; bit += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const storeZip = (entries) => {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const nameBuffer = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuffer, data);
    centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
};

const xhtml = (title, body) => `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fr">
<head><title>${title}</title></head>
<body>
${body}
</body>
</html>
`;

const titlePage = xhtml("Titre", `<h1>Le Seuil de Vasselonne</h1>\n<p>Manuscrit de démonstration Aldus</p>`);

const chapter = xhtml("Chapitre premier", `<h1>Chapitre premier : Le Seuil</h1>
<p>Le vent d’hiver soufflait sur le port de Vasselonne quand Aldus franchit la porte de la vieille imprimerie. Personne ne l’attendait. Les presses dormaient sous leurs bâches, et seule une lampe à huile éclairait la table où Isaure feuilletait un manuscrit relié de cuir noir.</p>
<p>— Qui est là ? s’écria-t-il d’une voix sourde.</p>
<p>— Attends… je crois que tu me reconnais, répondit l’inconnue.</p>
<p>Derrière lui, la porte se referma. Ce soir-là, Aldus posa sa sacoche sur la table, et le silence pesa soudain sur chaque page du manuscrit, comme une promesse qu’on hésite à tenir.</p>
<p>— Aldus revient toujours là où il a commencé. Ce n’est pas une surprise, dit-elle.</p>`);

const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:aldus:demo:le-seuil-de-vasselonne</dc:identifier>
    <dc:title>Le Seuil de Vasselonne</dc:title>
    <dc:language>fr</dc:language>
    <dc:creator>Auteur de démonstration</dc:creator>
  </metadata>
  <manifest>
    <item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
    <item id="chap1" href="chapitre-01.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="title"/>
    <itemref idref="chap1"/>
  </spine>
</package>
`;

const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;

writeFileSync(OUTPUT, storeZip([
  ["mimetype", "application/epub+zip"],
  ["META-INF/container.xml", container],
  ["OEBPS/content.opf", opf],
  ["OEBPS/title.xhtml", titlePage],
  ["OEBPS/chapitre-01.xhtml", chapter],
]));
console.log(`EPUB de démonstration écrit : ${OUTPUT}`);
