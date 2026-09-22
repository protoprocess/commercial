/* =============================================================================
   Proto Process — Déroulé guidé en pop-up
   Version 1.0 — 21/09/2026 (chantier 174, accueil unique)

   CE QUE FAIT CE FICHIER
   Un pop-up au centre de l'écran accompagne chaque étape d'une appli : consigne,
   conseil (rappel en jaune), aide quand l'étape est bloquée. « Je m'en occupe »
   l'écarte et surligne la zone de l'appli concernée ; dès que l'appli signale
   l'étape comme faite, le pop-up revient avec l'étape suivante.

   LES TEXTES NE SONT PAS ICI : ils vivent dans la table Supabase
   deroule_etapes (appli, n, titre, consigne, conseil, aide). On les modifie
   sans toucher au code.

   N'APPARAIT QUE SI ON EST PASSE PAR LE NOUVEL ACCUEIL (sessionStorage
   pp_accueil_url, posé par l'accueil). Sinon : rien ne change, la prod reste
   intacte pendant la recette.

   BRANCHEMENT DANS UNE APPLI (deux lignes) :
     1. <script src="../shared/deroule.js" data-appli="commande" defer></script>
     2. à chaque recalcul des étapes par l'appli :
        window.ppDeroule && window.ppDeroule.maj({
          etapes: [{ n, lib, done, bloque, manuel }], courante: n, dossier: '…'
        });
     L'appli doit porter data-etape="n" sur le bloc de chaque étape.

   MESURE DU TEMPS : chaque étape franchie est horodatée dans deroule_mesures
   (même session que l'accueil).
   ========================================================================== */
(function () {
  'use strict';
  var VERSION = '1.0';
  var SB = 'https://gzljssjjrqbxgnxugiqu.supabase.co/rest/v1';
  var KEY = 'sb_publishable_2-umPRDkyFtqcHhaqWAMoA_5IerFc0O';
  var TITRES = { commande: 'Saisir une commande client', devis: 'Créer un devis' };

  var script = document.currentScript;
  var appli = (script && script.getAttribute('data-appli')) || '';
  var accueil = null;
  try { accueil = sessionStorage.getItem('pp_accueil_url'); } catch (e) { accueil = null; }
  if (!appli || !accueil) { window.ppDeroule = { maj: function () {} }; return; }

  function lire(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var session = lire('pp_session') || ('s' + Date.now().toString(36));

  var textes = {};          // n -> { titre, consigne, conseil, aide }
  var etat = { etapes: [], courante: 0, dossier: '' };
  var faites = {};          // n -> true, pour ne mesurer qu'une fois
  var ecarte = false;       // l'utilisateur travaille dans l'appli
  var fini = false;

  function mesure(evenement, etape) {
    try {
      fetch(SB + '/deroule_mesures', { method: 'POST', keepalive: true,
        headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ personne: lire('pp_personne'), appli: appli, evenement: evenement,
          etape: etape == null ? null : String(etape), dossier: etat.dossier || null, session_id: session }) }).catch(function () {});
    } catch (e) {}
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- habillage (charte PP sombre) ---------- */
  var css = document.createElement('style');
  css.textContent =
    '#ppd-voile{position:fixed;inset:0;background:rgba(5,7,12,.72);display:none;align-items:center;justify-content:center;z-index:70;padding:20px}' +
    '#ppd-voile.on{display:flex}' +
    '#ppd{width:min(600px,100%);max-height:calc(100% - 20px);overflow:auto;background:#1a2030;color:#e2e8f0;border:1px solid #333d55;border-top:3px solid #F07B1F;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.5);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif}' +
    '#ppd .h{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:.5px solid #262e42}' +
    '#ppd .h b{font-weight:500}#ppd .h .n{margin-left:auto;color:#64748b;font-size:12px}' +
    '#ppd .pts{display:flex;gap:4px;padding:10px 16px 0}#ppd .pts span{flex:1;height:4px;border-radius:2px;background:#333d55}' +
    '#ppd .pts span.f{background:#86c564}#ppd .pts span.c{background:#F07B1F}' +
    '#ppd .b{padding:14px 16px}#ppd .ok{color:#86c564;font-size:12px;margin-bottom:6px}' +
    '#ppd h3{margin:0 0 8px;font-size:18px;font-weight:500}' +
    '#ppd .cons{margin:0 0 10px}' +
    '#ppd .cons-t{color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:2px}' +
    '#ppd .rap{background:#FAEEDA;color:#854F0B;border-radius:6px;padding:8px 10px;font-size:13px;margin-bottom:8px}' +
    '#ppd .aide{border-left:3px solid #A32D2D;background:#161b27;padding:8px 10px;font-size:13px;margin-bottom:8px;border-radius:0 6px 6px 0}' +
    '#ppd .f{display:flex;gap:8px;padding:0 16px 16px;justify-content:flex-end}' +
    '#ppd button{font:500 13px -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;border-radius:6px;padding:8px 14px;cursor:pointer}' +
    '#ppd .p{background:#F07B1F;color:#fff;border:none}#ppd .s{background:transparent;color:#94a3b8;border:.5px solid #333d55}' +
    '#ppd button:focus-visible{outline:2px solid #F07B1F;outline-offset:2px}' +
    '#ppd-barre{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:65;display:none;align-items:center;gap:10px;max-width:min(680px,calc(100vw - 260px));' +
      'background:#1a2030;color:#e2e8f0;border:1px solid #F07B1F;border-radius:20px;padding:7px 8px 7px 14px;box-shadow:0 4px 14px rgba(0,0,0,.35);font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif}' +
    '#ppd-barre.on{display:flex}#ppd-barre span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#ppd-barre button{flex:none;background:#F07B1F;color:#fff;border:none;border-radius:14px;padding:5px 12px;font-size:12px;font-weight:500;font-family:inherit;cursor:pointer}' +
    '.ppd-cible{outline:2px solid #F07B1F !important;outline-offset:4px;border-radius:6px;transition:outline-color .3s}' +
    '@media print{#ppd-voile,#ppd-barre{display:none!important}}';
  document.head.appendChild(css);

  var voile = document.createElement('div'); voile.id = 'ppd-voile';
  voile.innerHTML = '<div id="ppd" role="dialog" aria-modal="true" aria-labelledby="ppd-t"></div>';
  var barre = document.createElement('div'); barre.id = 'ppd-barre';
  function monter() { document.body.appendChild(voile); document.body.appendChild(barre); }
  if (document.body) monter(); else document.addEventListener('DOMContentLoaded', monter);
  var boite = voile.firstChild;

  /* ---------- rendu ---------- */
  function listeEtapes() {
    var l = etat.etapes.length ? etat.etapes.map(function (e) { return e.n; }) : [];
    return [0].concat(l);
  }
  function etapeCourante() {
    if (!etat.etapes.length) return { n: 0, done: false, bloque: false };
    var c = null;
    for (var i = 0; i < etat.etapes.length; i++) if (etat.etapes[i].n === etat.courante) c = etat.etapes[i];
    if (!c) for (var j = 0; j < etat.etapes.length; j++) if (etat.etapes[j].manuel) c = etat.etapes[j];
    return c || etat.etapes[etat.etapes.length - 1];
  }

  var derniereFaite = null;
  function afficher() {
    if (fini) return;
    var e = etapeCourante();
    var t = textes[e.n] || { titre: e.lib || ('Étape ' + e.n) };
    var liste = listeEtapes();
    var rang = liste.indexOf(e.n);
    var pts = liste.map(function (n, i) {
      var st = (n === 0 && etat.etapes.length) || (etat.etapes.some(function (x) { return x.n === n && x.done; })) ? 'f' : (i === rang ? 'c' : '');
      return '<span class="' + st + '"></span>';
    }).join('');
    var h = '<div class="h"><b>' + esc(TITRES[appli] || appli) + '</b><span class="n">étape ' + (rang + 1) + ' sur ' + liste.length + (etat.dossier ? ' · ' + esc(etat.dossier) : '') + '</span></div>' +
      '<div class="pts">' + pts + '</div><div class="b">' +
      (derniereFaite ? '<div class="ok">✓ ' + esc(derniereFaite) + ' : fait</div>' : '') +
      '<h3 id="ppd-t">' + esc(t.titre) + '</h3>' +
      (e.bloque && t.aide ? '<div class="aide"><span class="cons-t">Ça coince ?</span>' + esc(t.aide) + '</div>' : '') +
      (t.consigne ? '<p class="cons"><span class="cons-t">À faire</span>' + esc(t.consigne) + '</p>' : '') +
      (t.conseil ? '<div class="rap">' + esc(t.conseil) + '</div>' : '') +
      (!e.bloque && t.aide ? '<details style="font-size:13px;color:#94a3b8"><summary style="cursor:pointer">Et si ça coince ?</summary><p style="margin:6px 0 0">' + esc(t.aide) + '</p></details>' : '') +
      '</div><div class="f">' +
      (e.manuel ? '<button class="s" data-a="ecarter">Je vérifie dans Odoo</button><button class="p" data-a="terminer">C\u2019est fait, commande saisie</button>'
                : '<button class="p" data-a="ecarter">Je m\u2019en occupe</button>') +
      '</div>';
    boite.innerHTML = h;
    barre.innerHTML = '<span><b>' + esc(t.titre) + '</b> — ' + esc(t.consigne || '') + '</span><button type="button" data-a="revoir">Revoir le déroulé</button>';
    if (ecarte) { voile.classList.remove('on'); barre.classList.add('on'); }
    else { barre.classList.remove('on'); voile.classList.add('on'); var b = boite.querySelector('button.p'); if (b) b.focus(); }
  }

  function surligner(n) {
    document.querySelectorAll('.ppd-cible').forEach(function (x) { x.classList.remove('ppd-cible'); });
    var z = n === 0 ? (document.querySelector('input, textarea')) : document.querySelector('[data-etape="' + n + '"]');
    if (!z) return;
    if (n !== 0) z.classList.add('ppd-cible');
    try { z.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    if (n === 0 && z.focus) z.focus();
  }

  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest && ev.target.closest('[data-a]');
    if (!a || !(boite.contains(a) || barre.contains(a))) return;
    var act = a.getAttribute('data-a');
    if (act === 'ecarter') { ecarte = true; afficher(); surligner(etapeCourante().n); }
    else if (act === 'revoir') { ecarte = false; afficher(); }
    else if (act === 'terminer') {
      mesure('fin', 7); fini = true; voile.classList.remove('on'); barre.classList.remove('on');
      document.querySelectorAll('.ppd-cible').forEach(function (x) { x.classList.remove('ppd-cible'); });
    }
  });

  /* ---------- interface avec l'appli ---------- */
  window.ppDeroule = {
    version: VERSION,
    maj: function (o) {
      if (!o || !Array.isArray(o.etapes)) return;
      var avant = etapeCourante().n;
      var premiere = !etat.etapes.length;
      etat.etapes = o.etapes.map(function (e) { return { n: e.n, lib: e.lib, done: !!e.done, bloque: !!e.bloque, manuel: !!e.manuel }; });
      etat.courante = o.courante == null ? null : o.courante;
      if (o.dossier) etat.dossier = String(o.dossier);
      if (premiere) { mesure('debut', 0); derniereFaite = 'Commande trouvée'; }
      etat.etapes.forEach(function (e) {
        if (e.done && !faites[e.n]) { faites[e.n] = true; if (!premiere) mesure('etape', e.n); }
      });
      var apres = etapeCourante().n;
      if (apres !== avant || premiere) {
        if (!premiere) { var t = textes[avant]; derniereFaite = t ? t.titre : null; }
        ecarte = false;       // l'étape a changé : le pop-up revient au centre
      }
      fini = false;
      afficher();
    }
  };

  /* ---------- démarrage ---------- */
  fetch(SB + '/deroule_etapes?appli=eq.' + encodeURIComponent(appli) + '&select=n,titre,consigne,conseil,aide&order=n', { headers: { apikey: KEY } })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) { rows.forEach(function (r) { textes[r.n] = r; }); afficher(); })
    .catch(function () { afficher(); });
  mesure('ouverture', null);
})();
