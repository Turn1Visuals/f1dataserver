const sharp = require("sharp");
const path = require("path");

const src = path.join(__dirname, "../ui/public/favicon.svg");
const dest = path.join(__dirname, "icon.png");

sharp(src)
  .resize(256, 256)
  .png()
  .toFile(dest)
  .then(() => console.log("icon.png created"))
  .catch(console.error);
