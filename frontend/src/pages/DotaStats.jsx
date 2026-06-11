import { useState, useEffect } from "react";
import { getDotaStats } from "../api";
import { useApp } from "../store";

const parseRank = (tier, leaderboardRank) => {
  if (!tier) return { name: "Не відкалібровано", color: "var(--text-secondary)" };
  if (tier === 80 || leaderboardRank) {
    return { name: leaderboardRank ? `Immortal #${leaderboardRank}` : "Immortal", color: "var(--accent-red)" };
  }
  const medals = ["", "Herald", "Guardian", "Crusader", "Archon", "Legend", "Ancient", "Divine"];
  const medalIndex = Math.floor(tier / 10);
  const stars = tier % 10;
  const colors = ["", "#8B4513", "#DAA520", "#4169E1", "#D2691E", "#8B0000", "#A9A9A9", "#FFD700"];
  
  if (medalIndex >= medals.length) return { name: "Unknown", color: "var(--accent)" };
  return { name: `${medals[medalIndex]} ${stars}`, color: colors[medalIndex] };
};

// Повний словник всіх героїв Dota 2
const heroMap = {
  1: { name: "Anti-Mage", img: "antimage" }, 2: { name: "Axe", img: "axe" }, 3: { name: "Bane", img: "bane" }, 4: { name: "Bloodseeker", img: "bloodseeker" }, 5: { name: "Crystal Maiden", img: "crystal_maiden" }, 6: { name: "Drow Ranger", img: "drow_ranger" }, 7: { name: "Earthshaker", img: "earthshaker" }, 8: { name: "Juggernaut", img: "juggernaut" }, 9: { name: "Mirana", img: "mirana" }, 10: { name: "Morphling", img: "morphling" }, 11: { name: "Shadow Fiend", img: "nevermore" }, 12: { name: "Phantom Lancer", img: "phantom_lancer" }, 13: { name: "Puck", img: "puck" }, 14: { name: "Pudge", img: "pudge" }, 15: { name: "Razor", img: "razor" }, 16: { name: "Sand King", img: "sand_king" }, 17: { name: "Storm Spirit", img: "storm_spirit" }, 18: { name: "Sven", img: "sven" }, 19: { name: "Tiny", img: "tiny" }, 20: { name: "Vengeful Spirit", img: "vengefulspirit" }, 21: { name: "Windranger", img: "windrunner" }, 22: { name: "Zeus", img: "zuus" }, 23: { name: "Kunkka", img: "kunkka" }, 25: { name: "Lina", img: "lina" }, 26: { name: "Lion", img: "lion" }, 27: { name: "Shadow Shaman", img: "shadow_shaman" }, 28: { name: "Slardar", img: "slardar" }, 29: { name: "Tidehunter", img: "tidehunter" }, 30: { name: "Witch Doctor", img: "witch_doctor" }, 31: { name: "Lich", img: "lich" }, 32: { name: "Riki", img: "riki" }, 33: { name: "Enigma", img: "enigma" }, 34: { name: "Tinker", img: "tinker" }, 35: { name: "Sniper", img: "sniper" }, 36: { name: "Necrophos", img: "necrolyte" }, 37: { name: "Warlock", img: "warlock" }, 38: { name: "Beastmaster", img: "beastmaster" }, 39: { name: "Queen of Pain", img: "queenofpain" }, 40: { name: "Venomancer", img: "venomancer" }, 41: { name: "Faceless Void", img: "faceless_void" }, 42: { name: "Wraith King", img: "skeleton_king" }, 43: { name: "Death Prophet", img: "death_prophet" }, 44: { name: "Phantom Assassin", img: "phantom_assassin" }, 45: { name: "Pugna", img: "pugna" }, 46: { name: "Templar Assassin", img: "templar_assassin" }, 47: { name: "Viper", img: "viper" }, 48: { name: "Luna", img: "luna" }, 49: { name: "Dragon Knight", img: "dragon_knight" }, 50: { name: "Dazzle", img: "dazzle" }, 51: { name: "Clockwerk", img: "rattletrap" }, 52: { name: "Leshrac", img: "leshrac" }, 53: { name: "Nature's Prophet", img: "furion" }, 54: { name: "Lifestealer", img: "life_stealer" }, 55: { name: "Dark Seer", img: "dark_seer" }, 56: { name: "Clinkz", img: "clinkz" }, 57: { name: "Omniknight", img: "omniknight" }, 58: { name: "Enchantress", img: "enchantress" }, 59: { name: "Huskar", img: "huskar" }, 60: { name: "Night Stalker", img: "night_stalker" }, 61: { name: "Broodmother", img: "broodmother" }, 62: { name: "Bounty Hunter", img: "bounty_hunter" }, 63: { name: "Weaver", img: "weaver" }, 64: { name: "Jakiro", img: "jakiro" }, 65: { name: "Batrider", img: "batrider" }, 66: { name: "Chen", img: "chen" }, 67: { name: "Spectre", img: "spectre" }, 68: { name: "Ancient Apparition", img: "ancient_apparition" }, 69: { name: "Doom", img: "doom_bringer" }, 70: { name: "Ursa", img: "ursa" }, 71: { name: "Spirit Breaker", img: "spirit_breaker" }, 72: { name: "Gyrocopter", img: "gyrocopter" }, 73: { name: "Alchemist", img: "alchemist" }, 74: { name: "Invoker", img: "invoker" }, 75: { name: "Silencer", img: "silencer" }, 76: { name: "Outworld Destroyer", img: "obsidian_destroyer" }, 77: { name: "Lycan", img: "lycan" }, 78: { name: "Brewmaster", img: "brewmaster" }, 79: { name: "Shadow Demon", img: "shadow_demon" }, 80: { name: "Lone Druid", img: "lone_druid" }, 81: { name: "Chaos Knight", img: "chaos_knight" }, 82: { name: "Meepo", img: "meepo" }, 83: { name: "Treant Protector", img: "treant" }, 84: { name: "Ogre Magi", img: "ogre_magi" }, 85: { name: "Undying", img: "undying" }, 86: { name: "Rubick", img: "rubick" }, 87: { name: "Disruptor", img: "disruptor" }, 88: { name: "Nyx Assassin", img: "nyx_assassin" }, 89: { name: "Naga Siren", img: "naga_siren" }, 90: { name: "Keeper of the Light", img: "keeper_of_the_light" }, 91: { name: "Io", img: "wisp" }, 92: { name: "Visage", img: "visage" }, 93: { name: "Slark", img: "slark" }, 94: { name: "Medusa", img: "medusa" }, 95: { name: "Troll Warlord", img: "troll_warlord" }, 96: { name: "Centaur Warrunner", img: "centaur" }, 97: { name: "Magnus", img: "magnataur" }, 98: { name: "Timbersaw", img: "shredder" }, 99: { name: "Bristleback", img: "bristleback" }, 100: { name: "Tusk", img: "tusk" }, 101: { name: "Skywrath Mage", img: "skywrath_mage" }, 102: { name: "Abaddon", img: "abaddon" }, 103: { name: "Elder Titan", img: "elder_titan" }, 104: { name: "Legion Commander", img: "legion_commander" }, 105: { name: "Techies", img: "techies" }, 106: { name: "Ember Spirit", img: "ember_spirit" }, 107: { name: "Earth Spirit", img: "earth_spirit" }, 108: { name: "Underlord", img: "abyssal_underlord" }, 109: { name: "Terrorblade", img: "terrorblade" }, 110: { name: "Phoenix", img: "phoenix" }, 111: { name: "Oracle", img: "oracle" }, 112: { name: "Winter Wyvern", img: "winter_wyvern" }, 113: { name: "Arc Warden", img: "arc_warden" }, 114: { name: "Monkey King", img: "monkey_king" }, 119: { name: "Dark Willow", img: "dark_willow" }, 120: { name: "Pangolier", img: "pangolier" }, 121: { name: "Grimstroke", img: "grimstroke" }, 123: { name: "Hoodwink", img: "hoodwink" }, 126: { name: "Void Spirit", img: "void_spirit" }, 128: { name: "Snapfire", img: "snapfire" }, 129: { name: "Mars", img: "mars" }, 135: { name: "Dawnbreaker", img: "dawnbreaker" }, 136: { name: "Marci", img: "marci" }, 137: { name: "Primal Beast", img: "primal_beast" }, 138: { name: "Muerta", img: "muerta" }, 139: { name: "Kez", img: "kez" }, 145: { name: "Ringmaster", img: "ringmaster" }
};

const modeMap = {
  0: "Unknown", 1: "All Pick", 2: "Captains Mode", 3: "Random Draft", 4: "Single Draft", 5: "All Random",
  22: "All Draft (Ranked)", 23: "Turbo", 24: "Mutation"
};

// Компонент прогрес-бару (як в Dotabuff)
const StatBar = ({ title, wins, total, color }) => {
  if (!total) return null;
  const winRate = Math.round((wins / total) * 100);
  
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 6 }}>
        <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{title}</span>
        <span>
          <span style={{ color: "var(--text-bright)", fontWeight: 700 }}>{winRate}%</span> 
          <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>({total} {title.includes("Світло") ? "матчів" : "ігор"})</span>
        </span>
      </div>
      <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden", display: "flex" }}>
        <div style={{ width: `${winRate}%`, background: color, transition: "width 1s ease" }} />
        <div style={{ width: `${100 - winRate}%`, background: "var(--accent-red)", opacity: 0.8 }} />
      </div>
    </div>
  );
};

export default function DotaStats() {
  const store = useApp();
  const uk = store?.language === "uk";
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getDotaStats()
      .then(res => { if (res?.data) setStats(res.data); })
      .catch(err => {
        if (err.response?.status === 503) setError(err.response.data.detail);
        else setError(uk ? "Не вдалося завантажити дані. Спробуйте пізніше." : "Failed to load data.");
      })
      .finally(() => setLoading(false));
  }, [uk]);

  if (loading) return <div style={{ textAlign: "center", padding: "100px", color: "var(--text-secondary)" }}>{uk ? "Синхронізація аналітики..." : "Loading..."}</div>;
  if (error) return <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }} className="card"><p style={{ color: "var(--accent-red)", padding: 20 }}>{error}</p></div>;
  if (!stats) return null;

  const totalMatches = (stats.wins || 0) + (stats.losses || 0);
  const winRate = totalMatches > 0 ? Math.round((stats.wins / totalMatches) * 100) : 0;
  const rankInfo = parseRank(stats.rank_tier, stats.leaderboard_rank);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
      
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <img src="https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg" alt="Dota 2" style={{ width: 110, borderRadius: 6 }} />
        <div>
          <h1 style={{ color: "var(--text-bright)", fontSize: "1.6rem", margin: 0 }}>Dota 2 Esports</h1>
          <div style={{ color: "var(--text-secondary)", fontSize: ".85rem", marginTop: 4 }}>ID: {stats.account_id}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{uk ? "РАНГ" : "RANK"}</div>
          <div style={{ color: rankInfo.color, fontSize: "1.6rem", fontWeight: 800 }}>{rankInfo.name}</div>
        </div>
        <div className="card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{uk ? "ВІНРЕЙТ" : "WINRATE"}</div>
          <div style={{ color: "var(--accent-green)", fontSize: "1.6rem", fontWeight: 800 }}>{winRate}%</div>
        </div>
        <div className="card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{uk ? "ВСЬОГО МАТЧІВ" : "TOTAL MATCHES"}</div>
          <div style={{ color: "var(--text-bright)", fontSize: "1.6rem", fontWeight: 800 }}>{totalMatches}</div>
        </div>
        {/* 🔥 НОВА КАРТКА: Години у грі */}
        <div className="card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{uk ? "ГОДИН У ГРІ" : "HOURS PLAYED"}</div>
          <div style={{ color: "var(--accent-gold)", fontSize: "1.6rem", fontWeight: 800 }}>
            {/* Використовуємо toLocaleString(), щоб 4000 виглядало як красиво розділене 4 000 */}
            {stats.playtime_hours ? stats.playtime_hours.toLocaleString() : 0}
          </div>
        </div>
      </div>

      {/* ----------------- АНАЛІТИКА (ГРАФІКИ) ----------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16, marginBottom: 32 }}>
        
        {/* Фракції */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ color: "var(--text-bright)", fontSize: "1rem", margin: "0 0 20px 0", display: "flex", gap: 8 }}>
            <span>🗺️</span> {uk ? "Вінрейт за фракцію" : "Winrate by Faction"}
          </h2>
          <StatBar title={uk ? "Сили Світла (Radiant)" : "Radiant"} wins={stats.factions?.radiant?.win} total={stats.factions?.radiant?.games} color="#66bb6a" />
          <StatBar title={uk ? "Сили Тьми (Dire)" : "Dire"} wins={stats.factions?.dire?.win} total={stats.factions?.dire?.games} color="#ef5350" />
        </div>

        {/* Режими гри */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ color: "var(--text-bright)", fontSize: "1rem", margin: "0 0 20px 0", display: "flex", gap: 8 }}>
            <span>🎮</span> {uk ? "Популярні режими" : "Top Game Modes"}
          </h2>
          {stats.top_modes?.map((mode) => (
            <StatBar 
              key={mode.id} 
              title={modeMap[mode.id] || `Mode ${mode.id}`} 
              wins={mode.win} 
              total={mode.games} 
              color="var(--accent)" 
            />
          ))}
        </div>
      </div>

      {/* ----------------- ІСТОРІЯ МАТЧІВ ----------------- */}
      <div className="card" style={{ padding: "24px 0" }}>
        <h2 style={{ color: "var(--text-bright)", fontSize: "1.1rem", marginBottom: 20, padding: "0 24px", display: "flex", alignItems: "center", gap: 8 }}>
          <span>📜</span> {uk ? "Останні 20 ігор" : "Recent 20 Matches"}
        </h2>

        {(!stats.recent_matches || stats.recent_matches.length === 0) ? (
          <div style={{ color: "var(--text-secondary)", textAlign: "center", padding: 20 }}>
            {uk ? "Немає доступних свіжих матчів" : "No recent matches found"}
          </div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 2fr) 1fr 1fr 1fr 80px", padding: "0 24px 12px", color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1, borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
              <div>{uk ? "ГЕРОЙ ТА РЕЗУЛЬТАТ" : "HERO & RESULT"}</div>
              <div style={{ textAlign: "center" }}>K / D / A</div>
              <div style={{ textAlign: "center" }}>GPM / XPM</div>
              <div style={{ textAlign: "center" }}>{uk ? "ЧАС" : "DURATION"}</div>
              <div style={{ textAlign: "center" }}>{uk ? "МАТЧ" : "MATCH"}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {stats.recent_matches.map((m) => {
                const minutes = Math.floor(m.duration / 60);
                const seconds = String(m.duration % 60).padStart(2, "0");
                const hero = heroMap[m.hero_id] || { name: `Герой #${m.hero_id}`, img: "default" };
                const imgUrl = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${hero.img}.png`;

                return (
                  <div key={m.match_id} style={{ display: "grid", gridTemplateColumns: "minmax(200px, 2fr) 1fr 1fr 1fr 80px", alignItems: "center", padding: "12px 24px", borderLeft: `4px solid ${m.won ? "var(--accent-green)" : "var(--accent-red)"}`, borderBottom: "1px solid rgba(255, 255, 255, 0.03)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <img src={imgUrl} alt={hero.name} onError={(e) => e.target.src = "https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg"} style={{ width: 60, height: 34, borderRadius: 4, objectFit: "cover", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }} />
                      <div>
                        <div style={{ color: "var(--text-bright)", fontWeight: 700, fontSize: "0.95rem" }}>{hero.name}</div>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, marginTop: 2, color: m.won ? "var(--accent-green)" : "var(--accent-red)" }}>
                          {m.won ? "WIN" : "LOSS"}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "center", fontFamily: "monospace", fontSize: "1rem" }}>
                      <span style={{ color: "var(--text-bright)", fontWeight: 700 }}>{m.kills}</span><span style={{ color: "var(--text-secondary)", margin: "0 4px" }}>/</span><span style={{ color: "var(--accent-red)", fontWeight: 700 }}>{m.deaths}</span><span style={{ color: "var(--text-secondary)", margin: "0 4px" }}>/</span><span style={{ color: "var(--text-secondary)" }}>{m.assists}</span>
                    </div>
                    <div style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      <div style={{ marginBottom: 2 }}>GPM <span style={{ color: "var(--accent-gold)", fontWeight: 600 }}>{m.gpm}</span></div>
                      <div>XPM <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{m.xpm}</span></div>
                    </div>
                    <div style={{ textAlign: "center", fontSize: "0.95rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                      {minutes}:{seconds}
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <a href={`https://www.dotabuff.com/matches/${m.match_id}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", padding: "6px", borderRadius: "50%", background: "var(--bg-main)", border: "1px solid var(--border)", color: "var(--text-secondary)", transition: "all 0.2s" }} title="Відкрити на Dotabuff">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}