/* =============================================================================
   Proto Process — Déroulé guidé en pop-up (appli Commande)
   Version 2.0 — 22/09/2026 (chantier 174)

   PRINCIPE (validé sur maquette v0.4 le 21/09)
   Au clic « Diagnostiquer », un pop-up centré prend la main. On FAIT chaque
   étape DANS le pop-up : le bloc réel de l'appli pour l'étape en cours
   (ses champs, ses boutons) est déplacé dans le pop-up, puis remis à sa place.
   Aucune étape n'est sautée : une étape déjà faite par l'appli s'affiche
   « déjà fait : vérifie et valide ». Précédent / clic sur une étape validée.
   Panneau droit permanent : conseils, ce qui a été lu sur le bon de commande
   (pour info), aide, demande d'aide. Quitter (reprendre plus tard) ou
   Abandonner (la commande passe « écartée », sort de la liste et du compteur).
   Dernière étape : la confirmation Odoo est DÉTECTÉE en relançant le
   diagnostic (bouton « Vérifier dans Odoo »), rien à cocher ; seul geste : l'AR.

   Les textes vivent dans la table Supabase deroule_etapes (appli = commande).

   N'APPARAÎT QUE SI ON EST PASSÉ PAR LE NOUVEL ACCUEIL (sessionStorage
   pp_accueil_url). Sinon rien ne change : la prod reste intacte (recette).

   BRANCHEMENT : commande >= 7.10 appelle, à chaque rendu des étapes,
     window.ppDeroule.maj({ etapes: E, courante, dossier, so, ent, conf })
   et le pop-up s'appuie sur les blocs #pieces .et[data-etape="n"].
   v1.0 du 21/09 (pop-up qui commentait l'appli) rejetée puis retirée.
   ========================================================================== */
(function () {
  'use strict';
  var VERSION = '2.0';
  var SB = 'https://gzljssjjrqbxgnxugiqu.supabase.co/rest/v1';
  var KEY = 'sb_publishable_2-umPRDkyFtqcHhaqWAMoA_5IerFc0O';
  var appli = (document.currentScript && document.currentScript.getAttribute('data-appli')) || 'commande';
  var accueil = null;
  try { accueil = sessionStorage.getItem('pp_accueil_url'); } catch (e) { accueil = null; }
  if (!accueil) { window.ppDeroule = { version: VERSION, maj: function () {} }; return; }

  function lire(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var session = lire('pp_session') || ('s' + Date.now().toString(36));
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mesure(ev, etape, detail) {
    try {
      fetch(SB + '/deroule_mesures', { method: 'POST', keepalive: true,
        headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ personne: lire('pp_personne'), appli: appli, evenement: ev, etape: etape == null ? null : String(etape) + (detail ? ':' + detail : ''), dossier: S.dossier || null, session_id: session }) }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- état ---------- */
  var textes = {};
  var S = { E: [], courante: null, dossier: '', so: null, ent: null, conf: null };
  var ouvert = false, idx = 0, valides = {}, noeud = null, fini = false;
  var LIB = { 0: 'Commande', 1: 'Carte', 2: 'Article', 3: 'Devis', 4: 'Lien', 5: 'Projet', 6: 'Odoo', 7: 'AR' };

  /* ---------- habillage ---------- */
  var css = document.createElement('style');
  css.textContent =
    '#ppv{position:fixed;inset:0;background:rgba(5,7,12,.72);display:none;align-items:center;justify-content:center;z-index:70;padding:16px}#ppv.on{display:flex}' +
    '#ppd{width:min(1040px,100%);max-height:100%;display:flex;flex-direction:column;background:#1a2030;color:#e2e8f0;border:1px solid #333d55;border-top:3px solid #F07B1F;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.5);overflow:hidden;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif}' +
    '#ppd .tete{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:.5px solid #262e42}#ppd .tete b{font-weight:500;font-size:15px}#ppd .tete .d{color:#94a3b8;font-size:12px}' +
    '#ppd .quit{margin-left:auto;background:none;border:none;color:#64748b;font-size:12px;font-family:inherit;cursor:pointer;text-decoration:underline}' +
    '#ppd .pas{display:flex;gap:4px;padding:10px 18px;border-bottom:.5px solid #262e42;overflow-x:auto}' +
    '#ppd .pas button{flex:1;min-width:78px;background:none;border:none;border-top:3px solid #333d55;color:#64748b;font-size:11.5px;font-family:inherit;padding:6px 2px 0;text-align:left;cursor:default}' +
    '#ppd .pas button.f{border-top-color:#86c564;color:#94a3b8;cursor:pointer}#ppd .pas button.c{border-top-color:#F07B1F;color:#e2e8f0}#ppd .pas button span{display:block;font-size:10.5px;color:#64748b}' +
    '#ppd .corps{display:grid;grid-template-columns:1fr 300px;min-height:0;flex:1;overflow:hidden}' +
    '#ppd .travail{padding:16px 18px;overflow:auto}#ppd .cote{background:#161b27;border-left:.5px solid #262e42;padding:16px;overflow:auto;font-size:13px}' +
    '@media (max-width:760px){#ppd .corps{grid-template-columns:1fr}#ppd .cote{border-left:none;border-top:.5px solid #262e42}}' +
    '#ppd h2{margin:0 0 4px;font-size:19px;font-weight:500}#ppd .consigne{color:#94a3b8;margin:0 0 12px}' +
    '#ppd .deja{display:inline-block;background:#EAF3DE;color:#3B6D11;font-size:11.5px;border-radius:10px;padding:2px 9px;margin-bottom:8px}' +
    '#ppd .carte{background:#161b27;border:.5px solid #262e42;border-radius:6px;padding:10px 14px;margin-bottom:8px}#ppd .carte .k{color:#64748b;font-size:11.5px}' +
    '#ppd .hote{margin-top:6px}#ppd .hote .et{display:block!important;opacity:1!important;max-height:none!important;overflow:visible!important;border:none!important;padding:0!important;margin:0!important;background:transparent!important}' +
    '#ppd .hote .et>.num,#ppd .hote .et>.lib{display:none!important}#ppd .hote .et .corps{display:block!important}' +
    '#ppd .cote h4{margin:0 0 6px;font-size:11px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:.05em}#ppd .bloc{margin-bottom:16px}' +
    '#ppd .rap{background:#FAEEDA;color:#854F0B;border-radius:6px;padding:8px 10px;margin-bottom:6px}' +
    '#ppd .info{border-left:3px solid #5BC4D8;padding:6px 10px;background:#1a2030;border-radius:0 6px 6px 0;margin-bottom:6px;color:#94a3b8}' +
    '#ppd .aidebtn{width:100%;padding:9px;background:transparent;border:1px solid #5BC4D8;color:#5BC4D8;border-radius:6px;font-size:13px;font-weight:500;font-family:inherit;cursor:pointer}' +
    '#ppd .aideb{display:none;margin-top:8px;background:#1a2030;border:.5px solid #333d55;border-radius:6px;padding:10px;font-size:12.5px;color:#94a3b8}#ppd .aideb.on{display:block}' +
    '#ppd .pied{display:flex;align-items:center;gap:10px;padding:12px 18px;border-top:.5px solid #262e42}#ppd .pied .etat{color:#64748b;font-size:12px;margin-right:auto}' +
    '#ppd .bp{padding:8px 14px;background:#F07B1F;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:500;font-family:inherit;cursor:pointer}#ppd .bp:disabled{opacity:.4;cursor:not-allowed}' +
    '#ppd .bs{padding:7px 12px;background:transparent;color:#94a3b8;border:.5px solid #333d55;border-radius:6px;font-size:13px;font-family:inherit;cursor:pointer}#ppd .bs:disabled{opacity:.4}' +
    '#ppd .ok{color:#86c564}#ppd .att{color:#eab676;font-size:12.5px}' +
    '#ppm{position:fixed;inset:0;background:rgba(5,7,12,.6);display:none;align-items:center;justify-content:center;z-index:80;padding:16px}#ppm.on{display:flex}' +
    '#ppm .box{background:#1a2030;color:#e2e8f0;border:1px solid #333d55;border-top:3px solid #5BC4D8;border-radius:10px;padding:18px;max-width:460px;width:100%;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif}' +
    '#ppm h3{margin:0 0 6px;font-weight:500}#ppm p{color:#94a3b8;margin:0 0 12px;font-size:13px}#ppm .acts{display:flex;gap:8px;flex-wrap:wrap}#ppm select{width:100%;margin:0 0 12px;background:#0a0c12;color:#e2e8f0;border:.5px solid #333d55;border-radius:6px;padding:7px;font-family:inherit}' +
    '#ppm .bp,#ppm .bs{font-family:inherit;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer}#ppm .bp{background:#F07B1F;color:#fff;border:none;font-weight:500}#ppm .bs{background:transparent;color:#94a3b8;border:.5px solid #333d55}' +
    '@media print{#ppv,#ppm{display:none!important}}';
  document.head.appendChild(css);
  var voile = document.createElement('div'); voile.id = 'ppv';
  voile.innerHTML = '<div id="ppd" role="dialog" aria-modal="true" aria-labelledby="ppd-t"></div>';
  var modale = document.createElement('div'); modale.id = 'ppm';
  function monter() { document.body.appendChild(voile); document.body.appendChild(modale); }
  if (document.body) monter(); else document.addEventListener('DOMContentLoaded', monter);
  var boite = voile.firstChild;

  /* ---------- données du bon de commande ---------- */
  function brut() { return (S.ent && (S.ent.brut || S.ent)) || {}; }
  function fmtEur(v) { return v == null ? '' : (Number(v).toFixed(2).replace('.', ',') + ' \u20ac'); }
  function fmtDate(d) { if (!d) return ''; var m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(d); }
  function listeEtapes() { return [0].concat(S.E.map(function (e) { return e.n; })); }
  function etape(n) { for (var i = 0; i < S.E.length; i++) if (S.E[i].n === n) return S.E[i]; return null; }
  function soConfirmee() { return !!(S.so && /^(sale|done)$/.test(String(S.so.etat || ''))); }

  function resumeCommande() {
    var b = brut(), e = S.ent || {}, c = (b.contact_commande || {});
    var cad = Array.isArray(e.cadences) ? e.cadences : (Array.isArray(b.cadences) ? b.cadences : []);
    var h = '<div class="carte"><div class="k">Client</div>' + esc(e.client_detecte || b.client || (S.so && S.so.client) || '\u2014') + '</div>' +
      '<div class="carte"><div class="k">Commande client</div>' + esc(e.num_commande_client || b.num_commande_client || '\u2014') + (b.date_po ? ' du ' + esc(fmtDate(b.date_po)) : '') + (e.recu_le ? ', re\u00e7ue le ' + esc(fmtDate(e.recu_le)) : '') + (c.nom ? ' de ' + esc(c.nom) : '') + '</div>';
    if (cad.length) h += '<div class="carte"><div class="k">Lignes' + (e.nb_lots > 1 ? ' (lot ' + esc(e.lot) + ' sur ' + esc(e.nb_lots) + ')' : '') + '</div>' + cad.map(function (l) { return esc(l.ref_carte || '') + (l.indice ? ' indice ' + esc(l.indice) : '') + (l.designation ? ' \u00b7 ' + esc(l.designation) : '') + ' \u00b7 ' + esc(l.qte) + ' pi\u00e8ce(s)' + (l.prix_unitaire != null ? ' \u00e0 ' + esc(fmtEur(l.prix_unitaire)) : '') + (l.date ? ' pour le ' + esc(fmtDate(l.date)) : ''); }).join('<br>') + '</div>';
    if (S.so && S.so.so) h += '<div class="carte"><div class="k">Devis Odoo retenu</div>' + esc(S.so.so) + (S.so.etat ? ' \u00b7 ' + esc(S.so.etat) : '') + '</div>';
    if (!S.ent) h += '<div class="att">Pas de bon de commande lu par mail pour ce dossier : les comparaisons se feront avec le PDF.</div>';
    return h;
  }
  function infosCote(n) {
    var b = brut(), h = '';
    if (n === 3) {
      var cad = Array.isArray(b.cadences) ? b.cadences : [];
      if (cad.length) h += cad.map(function (l) { return '<div class="info">' + esc(l.ref_carte || '') + ' : ' + esc(l.qte) + ' \u00d7 ' + esc(fmtEur(l.prix_unitaire)) + (l.date ? ', livraison ' + esc(fmtDate(l.date)) : '') + '</div>'; }).join('');
      if (b.mention_tva) h += '<div class="info">TVA : ' + esc(b.mention_tva) + '</div>';
      if (b.conditions_paiement) h += '<div class="info">Paiement : ' + esc(b.conditions_paiement) + '</div>';
      if (b.incoterm) h += '<div class="info">Incoterm : ' + esc(b.incoterm) + '</div>';
    }
    if (n === 6) {
      if (b.adresse_livraison) h += '<div class="info">Livraison : ' + esc(b.adresse_livraison) + '</div>';
      if (b.adresse_facturation) h += '<div class="info">Facturation : ' + esc(b.adresse_facturation) + '</div>';
      var c = b.contact_commande || {}, a = b.contact_achat || {};
      if (c.nom || c.email) h += '<div class="info">A pass\u00e9 la commande : ' + esc(c.nom || '') + (c.email ? ' (' + esc(c.email) + ')' : '') + '</div>';
      if (a.nom || a.email) h += '<div class="info">Achats : ' + esc(a.nom || '') + (a.email ? ' (' + esc(a.email) + ')' : '') + '</div>';
    }
    if ((n === 3 || n === 6 || n === 7) && Array.isArray(b.exigences) && b.exigences.length) h += b.exigences.map(function (x) { return '<div class="info">' + esc(x) + '</div>'; }).join('');
    return h ? '<div class="bloc"><h4>Lu sur le bon de commande (pour info)</h4>' + h + '</div>' : '';
  }

  /* ---------- déplacement du bloc réel de l'appli ---------- */
  function rendreNoeud() {
    if (noeud && noeud.parentNode) { var fr = document.querySelector('#pieces .fr'); if (fr && !fr.contains(noeud)) fr.appendChild(noeud); }
    noeud = null;
  }
  function prendreNoeud(n, hote) {
    rendreNoeud();
    var x = document.querySelector('#pieces .et[data-etape="' + n + '"]');
    if (!x) { hote.innerHTML = '<div class="att">Cette \u00e9tape n\u2019est pas encore disponible : termine la pr\u00e9c\u00e9dente.</div>'; return; }
    noeud = x; hote.appendChild(x);
  }

  /* ---------- rendu ---------- */
  function rendre() {
    var liste = listeEtapes(); if (idx >= liste.length) idx = liste.length - 1;
    var n = liste[idx], e = etape(n) || {}, t = textes[n] || {};
    var titre = t.titre || e.lib || ('\u00c9tape ' + n);
    var d = (S.so && S.so.client ? S.so.client + ' \u00b7 ' : '') + (S.dossier || '');
    var pas = liste.map(function (k, i) { var v = i < idx || valides[k]; return '<button type="button" class="' + (i === idx ? 'c' : (v ? 'f' : '')) + '" data-k="' + i + '"' + (v && i !== idx ? '' : ' tabindex="-1"') + '>' + (k ? k + '. ' : '') + esc(LIB[k] || e.lib || '') + '<span>' + (i === idx ? 'en cours' : (v ? 'valid\u00e9e' : '')) + '</span></button>'; }).join('');
    var deja = n > 0 && e.done && !valides[n];
    var peut, hint = '';
    if (n === 0) peut = true;
    else if (e.manuel) { peut = soConfirmee(); hint = peut ? '' : 'Confirme la commande dans Odoo, puis clique \u00ab V\u00e9rifier dans Odoo \u00bb.'; }
    else { peut = !!e.done; hint = peut ? '' : (e.bloque ? 'Cette \u00e9tape est bloqu\u00e9e : vois l\u2019aide \u00e0 droite.' : 'Termine l\u2019action ci-dessus : le d\u00e9roul\u00e9 le d\u00e9tectera.'); }
    var travail = (deja ? '<span class="deja">D\u00e9j\u00e0 fait par l\u2019appli : v\u00e9rifie et valide</span>' : '') +
      '<h2 id="ppd-t">' + esc(titre) + '</h2>' + (t.consigne ? '<p class="consigne">' + esc(t.consigne) + '</p>' : '');
    if (n === 0) travail += resumeCommande();
    else if (e.manuel) travail += '<div class="carte"><div class="k">Commande dans Odoo</div>' + (soConfirmee() ? '<span class="ok">\u2713 Confirm\u00e9e dans Odoo' + (S.so && S.so.so ? ' (' + esc(S.so.so) + ')' : '') + '</span>' : 'Pas encore confirm\u00e9e <span style="color:#64748b">(d\u00e9tection automatique)</span>') + '</div>' +
      '<div class="hote"></div><div style="margin-top:10px"><button type="button" class="bs" data-a="verif">V\u00e9rifier dans Odoo</button> <span class="att" id="ppd-verif"></span></div>';
    else travail += '<div class="hote"></div>';
    var cote = '<div class="bloc"><h4>Conseils</h4>' + (t.conseil ? '<div class="rap">' + esc(t.conseil) + '</div>' : '<div class="info">\u2014</div>') + '</div>' + infosCote(n) +
      '<div class="bloc"><h4>Et si \u00e7a coince ?</h4><p style="margin:0 0 10px;color:#94a3b8">' + esc(t.aide || '') + (n === 6 && S.so && S.so.partner_id ? ' <a href="https://protoprocess-main-16873066.dev.odoo.com/odoo/contacts/' + esc(S.so.partner_id) + '" target="_blank" rel="noopener" style="color:#F07B1F">Fiche de la soci\u00e9t\u00e9 dans Odoo \u2197</a>' : '') + '</p>' +
      '<button type="button" class="aidebtn" data-a="aide">Demander de l\u2019aide \u00e0 Claude</button><div class="aideb" id="ppd-aide">L\u2019assistant arrive avec la prochaine version de l\u2019accueil (\u00ab Rien de tout \u00e7a \u00bb). En attendant : d\u00e9cris ton blocage avec le bouton <b>Signaler</b> en bas \u00e0 droite, en indiquant \u00ab ' + esc(S.dossier || '') + ', \u00e9tape ' + esc(titre) + ' \u00bb.</div></div>';
    boite.innerHTML = '<div class="tete"><b>Saisir une commande client</b><span class="d">' + esc(d) + '</span><button type="button" class="quit" data-a="quit">Quitter ou abandonner</button></div>' +
      '<div class="pas">' + pas + '</div><div class="corps"><div class="travail">' + travail + '</div><aside class="cote">' + cote + '</aside></div>' +
      '<div class="pied"><span class="etat">\u00c9tape ' + (idx + 1) + ' sur ' + liste.length + (hint ? ' \u2014 ' + esc(hint) : '') + '</span>' +
      '<button type="button" class="bs" data-a="prec"' + (idx === 0 ? ' disabled' : '') + '>Pr\u00e9c\u00e9dent</button>' +
      '<button type="button" class="bp" data-a="suiv"' + (peut ? '' : ' disabled') + '>' + (e.manuel ? 'Terminer' : 'Valider et continuer') + '</button></div>';
    var hote = boite.querySelector('.hote');
    if (hote && n > 0) prendreNoeud(n, hote); else rendreNoeud();
    voile.classList.add('on');
  }

  function fermer(evt, detail) {
    rendreNoeud(); voile.classList.remove('on'); modale.classList.remove('on'); ouvert = false;
    if (evt) mesure(evt, listeEtapes()[idx], detail);
  }

  /* ---------- actions ---------- */
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest && ev.target.closest('[data-a],[data-k]');
    if (!a || !(boite.contains(a) || modale.contains(a))) return;
    if (a.hasAttribute('data-k')) { var k = Number(a.getAttribute('data-k')); if (k < idx || valides[listeEtapes()[k]]) { idx = k; rendre(); } return; }
    var act = a.getAttribute('data-a'), liste = listeEtapes(), n = liste[idx];
    if (act === 'suiv') {
      valides[n] = true; mesure('etape', n);
      if (etape(n) && etape(n).manuel) { fini = true; fermer('fin', 'confirmee'); try { chargerEntrantes(); } catch (e) {} return; }
      if (idx < liste.length - 1) idx++; rendre();
    } else if (act === 'prec') { if (idx > 0) idx--; rendre(); }
    else if (act === 'aide') { var b = boite.querySelector('#ppd-aide'); if (b) b.classList.toggle('on'); mesure('etape', n, 'aide'); }
    else if (act === 'verif') { var s = boite.querySelector('#ppd-verif'); if (s) s.textContent = 'Lecture d\u2019Odoo\u2026'; try { diagnostiquer(true); } catch (e) { if (s) s.textContent = 'Relance impossible : recharge la page.'; } }
    else if (act === 'quit') {
      modale.innerHTML = '<div class="box"><h3>Quitter le d\u00e9roul\u00e9 ?</h3><p>Reprendre plus tard : rien n\u2019est perdu, la commande reste dans la liste. Abandonner : cette commande ne sera pas saisie, elle sort de la liste (r\u00e9cup\u00e9rable par l\u2019\u00e9quipe si besoin).</p>' +
        '<select id="ppd-raison"><option value="">Raison de l\u2019abandon (si abandon)</option><option>Doublon</option><option>Annul\u00e9e par le client</option><option>Ce n\u2019est pas une commande</option><option>Autre</option></select>' +
        '<div class="acts"><button type="button" class="bp" data-a="reste">Continuer le d\u00e9roul\u00e9</button><button type="button" class="bs" data-a="plustard">Reprendre plus tard</button><button type="button" class="bs" data-a="abandon"' + (S.ent && S.ent.id ? '' : ' disabled title="Pas de commande entrante rattach\u00e9e"') + '>Abandonner</button></div></div>';
      modale.classList.add('on');
    } else if (act === 'reste') modale.classList.remove('on');
    else if (act === 'plustard') fermer('abandon', 'plus_tard');
    else if (act === 'abandon') {
      var raison = (modale.querySelector('#ppd-raison') || {}).value || '';
      if (!raison) { modale.querySelector('#ppd-raison').style.borderColor = '#F07B1F'; return; }
      a.disabled = true;
      try {
        appel('commande-entrante-etat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: parseInt(S.ent.id, 10), etat: 'ecartee' }) })
          .then(function () { fermer('abandon', raison); try { chargerEntrantes(); } catch (e) {} })
          .catch(function () { a.disabled = false; a.textContent = '\u00c9chec, r\u00e9essayer'; });
      } catch (e) { a.disabled = false; }
    }
  });

  /* ---------- interface avec l'appli ---------- */
  window.ppDeroule = {
    version: VERSION,
    maj: function (o) {
      if (!o || !Array.isArray(o.etapes) || !o.etapes.length) return;
      var premier = !ouvert;
      S.E = o.etapes.map(function (e) { return { n: e.n, lib: e.lib, done: !!e.done, bloque: !!e.bloque, manuel: !!e.manuel }; });
      S.courante = o.courante; if (o.dossier) S.dossier = String(o.dossier);
      S.so = o.so || S.so; S.ent = o.ent || S.ent; S.conf = o.conf || S.conf;
      if (premier) { ouvert = true; idx = 0; valides = {}; fini = false; mesure('debut', 0); }
      if (fini) return;
      rendre();
      var s = boite.querySelector('#ppd-verif'); if (s) s.textContent = soConfirmee() ? '' : 'Pas encore confirm\u00e9e dans Odoo.';
    }
  };
  fetch(SB + '/deroule_etapes?appli=eq.' + encodeURIComponent(appli) + '&select=n,titre,consigne,conseil,aide&order=n', { headers: { apikey: KEY } })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) { rows.forEach(function (r) { textes[r.n] = r; }); if (ouvert) rendre(); }).catch(function () {});
  mesure('ouverture', null);
})();
