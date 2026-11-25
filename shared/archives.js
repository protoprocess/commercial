/* PP — archives 7z / rar -> zip, dans le navigateur. v1.0 — 25/11/2026 (go Olivier, phase 0 devis).
   Pourquoi : le 25/11, la demande IP2I FTS_C&C_V1 est arrivee en .7z. L analyse et Luminovo ne lisent que
   le zip : le dossier a ete repris a la main, sans le mail, et l etape 4 est passee sans fichiers PCB.
   Ce module transforme un .7z ou un .rar en .zip (memes fichiers, memes dossiers) AVANT tout envoi.
   Rien ne quitte le poste : 7-Zip tourne ici, en WebAssembly (7z-wasm 1.2.0, copie dans shared/vendor,
   aucun appel a un site exterieur). Le moteur (1,6 Mo) n est charge qu au premier .7z / .rar.
   Usage : const zip = await PPArchives.versZip(file)  // rend un File .zip, ou le fichier tel quel si deja zip */
(function () {
  const BASE = new URL('vendor/7z-wasm-1.2.0/', document.currentScript ? document.currentScript.src : location.href).href;
  let moteur = null;
  const charger = () => import(BASE + '7zz.es6.js').then(m => m.default);
  const aConvertir = nom => /\.(7z|rar)$/i.test(nom || '');
  async function versZip(file) {
    if (!file || !aConvertir(file.name)) return file;
    if (!moteur) moteur = charger();
    const SevenZip = await moteur;
    const journal = [];
    const sz = await SevenZip({ print: t => journal.push(t), printErr: t => journal.push(t), locateFile: f => BASE + f });
    const ext = file.name.match(/\.(7z|rar)$/i)[1].toLowerCase();
    sz.FS.writeFile('/in.' + ext, new Uint8Array(await file.arrayBuffer()));
    sz.FS.mkdir('/out');
    try { sz.callMain(['x', '/in.' + ext, '-o/out', '-y']); } catch (e) { /* 7-Zip sort par exit() : on juge sur le resultat */ }
    const contenu = sz.FS.readdir('/out').filter(x => x !== '.' && x !== '..');
    if (!contenu.length) throw new Error('Archive « ' + file.name + ' » illisible ou protégée par mot de passe. ' + journal.filter(l => /error|wrong|password/i.test(l)).slice(0, 2).join(' '));
    sz.FS.chdir('/out');
    try { sz.callMain(['a', '-tzip', '/res.zip', '*', '-r']); } catch (e) { }
    let octets;
    try { octets = sz.FS.readFile('/res.zip'); } catch (e) { throw new Error('Conversion en zip impossible pour « ' + file.name + ' ».'); }
    const nom = file.name.replace(/\.(7z|rar)$/i, '') + '.zip';
    return new File([octets], nom, { type: 'application/zip', lastModified: Date.now() });
  }
  window.PPArchives = { versZip, aConvertir, version: '1.0' };
})();
