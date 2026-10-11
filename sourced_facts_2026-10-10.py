# Faits de terrain SOURCÉS (recherche du 10/10/2026). Chaque fait porte sa source.
# Rien n'est ajouté sans citation ; les classements (encombrement, gratter) restent
# des déductions tant qu'une source ou Félix ne les confirme pas.
import json, re

WIKI_LOG = "Wikipédia — Logonna-Daoulas (géographie)"
VA = "Voile-Aviron, livret « 50 sites de la rade de Brest »"
OT = "Office de tourisme Landerneau-Daoulas"
FACTS = {
 "moulinmer": [
  ("Moulin-Mer est sur la rive SUD de la presqu'île de Logonna, à l'embouchure de la rivière de l'Hôpital (ria du Camfrout).", WIKI_LOG),
  ("Concessions ostréicoles « de Moulin-Mer à Kervella au sud ».", WIKI_LOG),
  ("Le terre-plein du centre nautique a été construit avec les déblais des carrières de kersanton voisines.", WIKI_LOG),
  ("Le moulin à marée est « à l'abri des vagues de la rade ».", OT),
  ("Cale étroite et en virage, utilisable à mi-marée.", VA),
 ],
 "bendy": [
  ("La pointe du Bendy est l'extrémité ouest de la presqu'île de Logonna.", WIKI_LOG),
  ("Sillon en tombolo, doublé d'un second cordon qui forme un bassin abrité.", VA),
  ("Roche de La Coët, non balisée, à contourner au large.", VA),
 ],
 "rostiviec": [
  ("Le sillon de Rostiviec « a du mal à émerger à marée haute » ; derrière, une anse assez abritée ; la cale du quai donne sur une grève praticable.", VA),
  ("L'anse de Penfoul « se vide entièrement à marée basse ».", OT),
 ],
 "camfrout": [
  ("L'îlot de Tibidy est privé ; on ne peut aborder que côté est du tombolo.", VA),
 ],
 "lauberlach": [
  ("La passe du sillon « peut connaître un courant assez fort » ; accès bateau à ± 1 h de la pleine mer.", VA),
  ("Plage intérieure : « le sable le plus accueillant (il peut y avoir quelques cailloux) ».", VA),
  ("Anse « assez exposée au S et SW », à éviter au mouillage en hiver.", "Forum Hisse et Ho — mouillages en rade de Brest"),
 ],
 "landevennec": [
  ("Près du cimetière de bateaux : « berges composées de roches à huîtres avec du goémon qui descend dans l'eau », plage de galets d'ardoise.", "peche.com — « À la recherche du bar du côté du cimetière de bateaux en fond de rade de Brest »"),
  ("Même article : une dizaine de bars maillés, autour de 60 cm, en traîne lente de poissons nageurs le long des tombants, coefficient 50, basse mer vers 9 h 30.", "peche.com"),
  ("Sillon des Anglais : tombants à la tête est de la flèche ; pas d'accès routier.", VA),
 ],
 "espagnols": [
  ("Herbier de zostères « en ruban » sur la côte de Roscanvel, près de la pointe des Espagnols (station de suivi).", "Ifremer REBENT — lieux des herbiers de Zostera marina"),
  ("La roche de la Cormorandière « fait l'objet de tourbillons que l'on se gardera bien d'approcher ».", VA),
 ],
 "pirou": [
  ("« De Pirou à Barneville-Carteret s'étendent de grandes plages sableuses, entrecoupées par quatre havres. »", "CPIE du Cotentin — où pêcher"),
  ("Des pêcheurs locaux pêchent le bar au leurre souple sur les bouchots et les tables à huîtres de Pirou plage.", "Forum Pêche en mer Cotentin — « pêche au bar »"),
 ],
 "gouville": [
  ("ZNIEFF marine « Estran rocheux de Gouville à Agon-Coutainville » : « vaste estran rocheux et sableux » de 3 866 ha, du phare du Sénéquet à la tour du Ronquet.", "INPN — ZNIEFF 25M000020"),
  ("On y trouve des herbiers de zostères (Zostera marina et noltei), des récifs d'hermelles temporaires et des platiers à algues rouges ; granulométrie de la vase aux blocs.", "INPN — ZNIEFF 25M000020"),
 ],
 "agon": [
  ("L'estran rocheux et sableux de la ZNIEFF Gouville–Agon s'étend jusqu'à la tour du Ronquet, au large d'Agon-Coutainville.", "INPN — ZNIEFF 25M000020"),
  ("Le havre de la Sienne se traverse à pied à marée basse seulement, accompagné : « trop dangereux seul ».", "Attitude Manche via Cirkwi — Le havre de Sienne"),
 ],
 "regneville": [
  ("Le havre de la Sienne se traverse à pied à marée basse seulement, accompagné : « trop dangereux seul ». Il est séparé de la mer par l'espace naturel classé de la pointe d'Agon.", "Attitude Manche via Cirkwi — Le havre de Sienne"),
 ],
 "portbail": [
  ("À Portbail, le platier rocheux porte moules, coquilles Saint-Jacques et étrilles.", "CPIE du Cotentin — où pêcher"),
 ],
 "carteret": [
  ("De Carteret à Urville-Nacqueville « alternent baies sableuses et caps rocheux », avec des platiers rocheux au pied des caps.", "CPIE du Cotentin — où pêcher"),
 ],
 "sciotot": [
  ("Barre rocheuse au niveau de la Roquette, dans l'anse.", "Normandie Tourisme — Plage de Sciotot"),
  ("Réglementation locale : « le mode de pêche à l'hameçon (paillots…), lors de la période autorisée (16/09 au 14/06) est strictement interdit au droit de la cale jusqu'à la barre rocheuse au niveau de la Roquette » ; pêche interdite dans la zone de baignade surveillée. Vérifier en mairie si le lancer est concerné.", "Normandie Tourisme — Plage de Sciotot"),
 ],
 "surtainville": [
  ("Site Natura 2000 « Banc et récifs de Surtainville » : 6 331 ha de bancs de sable et 281 ha de récifs ; leur position par rapport au bord n'est pas précisée.", "INPN — Natura 2000 FR2502018"),
 ],
 "goury": [
  ("Pointe de la Hague : sorties du soir sous les falaises ; shads de 10 cm plombés de 12 à 25 g selon le courant pour imiter le sprat, laissés descendre « de 1 à 2 mètres maximum » ; Black Minnow coloris Ayu très efficace ; suivre les oiseaux.", "peche.com — « Sortie de pêche estivale à la recherche des bars du Cotentin »"),
  ("Les bars de chasse sont souvent calibrés ; il est « rare de faire de gros poissons lors des chasses ».", "peche.com"),
 ],
}
SPOT_SOURCES = {
 "moulinmer": ["fr.wikipedia.org — Logonna-Daoulas (géographie : Moulin-Mer, rive sud, embouchure de la rivière de l'Hôpital)", "tourisme-landerneau-daoulas.fr — sentier littoral de Logonna et escapade en rade", "voileaviron.org — livret des sites de la rade de Brest"],
 "bendy": ["fr.wikipedia.org — Logonna-Daoulas", "voileaviron.org — livret des sites de la rade de Brest"],
 "rostiviec": ["voileaviron.org — livret des sites de la rade de Brest", "tourisme-landerneau-daoulas.fr — sentier littoral (anse de Penfoul)"],
 "camfrout": ["voileaviron.org — livret des sites de la rade de Brest (Tibidy privé)"],
 "lauberlach": ["voileaviron.org — livret des sites de la rade de Brest", "hisse-et-oh.com — forum mouillages en rade de Brest"],
 "landevennec": ["peche.com — À la recherche du bar du côté du cimetière de bateaux en fond de rade de Brest", "voileaviron.org — livret des sites de la rade de Brest"],
 "espagnols": ["rebent.ifremer.fr — FL05 lieux des herbiers de Zostera marina (Roscanvel)", "voileaviron.org — livret des sites de la rade de Brest"],
 "pirou": ["pechemercotentin.forumactif.org — sujet « pêche au bar »"],
 "gouville": ["inpn.mnhn.fr — ZNIEFF marine 25M000020 Estran rocheux de Gouville à Agon-Coutainville"],
 "agon": ["inpn.mnhn.fr — ZNIEFF marine 25M000020", "cirkwi.com — Le havre de Sienne (Attitude Manche)"],
 "regneville": ["cirkwi.com — Le havre de Sienne (Attitude Manche)"],
 "sciotot": ["normandie-tourisme.fr — Plage de Sciotot (réglementation de la pêche)"],
 "surtainville": ["inpn.mnhn.fr — Natura 2000 FR2502018 Banc et récifs de Surtainville"],
 "goury": ["peche.com — Sortie de pêche estivale à la recherche des bars du Cotentin"],
}

def js(v): return json.dumps(v, ensure_ascii=False)

def spot_span(t, sid):
    a = t.index('\n    id:"' + sid + '"')
    b = t.find('\n    id:"', a + 10)
    return a, (b if b > 0 else len(t))

for f in ("src/sites/logonna.config.js", "src/sites/pirou.config.js"):
    t = open(f, encoding="utf-8").read()
    if "faits:[" in t:
        print(f, ": déjà appliqué"); continue
    for sid, facts in FACTS.items():
        if '\n    id:"' + sid + '"' not in t: continue
        a, b = spot_span(t, sid); seg = t[a:b]
        m = re.search(r'(\n      source:"[^"]*",\n)(    \},)', seg)
        assert m, sid
        body = ",\n".join("        { t:%s, s:%s }" % (js(x), js(s)) for x, s in facts)
        seg = seg[:m.end(1)] + "      // Faits précis tirés de sources citées (recherche du 10/10/2026).\n      faits:[\n" + body + ",\n      ],\n" + seg[m.end(1):]
        if sid in SPOT_SOURCES:
            ms = re.search(r'\n    sources:\[\n', seg)
            assert ms, sid
            ins = "".join("      %s,\n" % js(s) for s in SPOT_SOURCES[sid])
            seg = seg[:ms.end()] + ins + seg[ms.end():]
        t = t[:a] + seg + t[b:]

    # Moulin Mer : la géographie sourcée contredit l'orientation de la version d'origine.
    if 'id:"moulinmer"' in t:
        a, b = spot_span(t, "moulinmer"); seg = t[a:b]
        def r(old, new):
            global seg
            assert seg.count(old) == 1, old[:70]; seg = seg.replace(old, new)
        r('subtitle:"Pointe du Château, Logonna-Daoulas"', 'subtitle:"Anse de Moulin-Mer, Logonna-Daoulas"')
        r('exposedAngles:[315,337.5,292.5], shelteredAngles:[135,157.5,112.5],',
          '// v6.1 — Orientation corrigée : Moulin-Mer est sur la rive SUD de la presqu\'île\n    // (Wikipédia), et non sur la bordure nord. À confirmer par Félix sur place.\n    exposedAngles:[180,202.5,225], shelteredAngles:[0,22.5,337.5],')
        r('weatherNote:"Bordure nord de la presqu\'île de Logonna. Protégé des vents de S/SE par les terres ; exposé NO/N sur la rade."',
          'weatherNote:"Rive sud de la presqu\'île de Logonna, à l\'embouchure de la rivière de l\'Hôpital-Camfrout (Wikipédia). La presqu\'île abrite des vents de nord ; c\'est le secteur sud-ouest qui lève un clapot dans l\'anse. Orientation à confirmer sur place."')
        m = re.search(r'exposition:\{ text:"[^"]*", confidence:"\w+" \}', seg)
        seg = seg[:m.start()] + 'exposition:{ text:"Rive sud de la presqu\'île, ouverte sur la ria du Camfrout (Wikipédia). Abritée des vents de N à NE par la presqu\'île ; exposée au S-SO. La version d\'origine la disait « orientée NO » : contredit par la géographie, à confirmer sur place.", confidence:"inference" }' + seg[m.end():]
        r('"Lancer parallèle aux bordures et faire nager le leurre au-dessus du goémon, jamais dedans."',
          '"Lancer parallèle aux bordures et faire nager le leurre au-dessus du goémon, jamais dedans.", "Respecter les parcs à huîtres (concessions de Moulin-Mer à Kervella) : ne pas les traverser ni lancer dedans."')
        t = t[:a] + seg + t[b:]
    if 'id:"camfrout"' in t:
        t = t.replace('Accès à Troaon, Kerdreolet et au cordon de Tibidy.', 'Accès à Troaon, Kerdreolet et au cordon de Tibidy (l\'îlot de Tibidy est privé : ne pas y monter).', 1)
    if 'id:"sciotot"' in t:
        t = t.replace('access:"Parking de la plage de Sciotot, accès direct. Caps accessibles à pied par l\'estran à marée descendante."',
                      'access:"Parking de la plage de Sciotot, accès direct. Caps accessibles à pied par l\'estran à marée descendante. Réglementation locale de la pêche à l\'hameçon entre la cale et la barre rocheuse de la Roquette (voir fiche terrain) ; pêche interdite dans la zone de baignade surveillée l\'été."', 1)
    for sid in ("regneville", "agon"):
        if '\n    id:"' + sid + '"' in t:
            a, b = spot_span(t, sid); seg = t[a:b]
            m = re.search(r'(      conseils:\[)', seg)
            seg = seg[:m.end()] + js("Ne jamais traverser le havre à pied seul : la traversée se fait à marée basse et accompagnée (Attitude Manche).") + ", " + seg[m.end():]
            t = t[:a] + seg + t[b:]
    open(f, "w", encoding="utf-8").write(t)
    print(f, ": faits sourcés ajoutés")
