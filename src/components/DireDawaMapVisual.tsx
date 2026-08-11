import React, { useState } from 'react';
import { MapPin, Compass, Map as MapIcon, Search, Users, ExternalLink, ZoomIn, ZoomOut, RotateCcw, Layers, Navigation } from 'lucide-react';

interface ResidenceItem {
  label: string;
  count: number;
  percentage: number;
}

interface DireDawaMapVisualProps {
  residenceData: ResidenceItem[];
  totalResponses: number;
}

// Dire Dawa Google Maps official coordinates & URL
const DIRE_DAWA_GOOGLE_MAPS_URL =
  'https://www.google.com/maps/place/Dire+Dawa/@9.6043902,41.857339,17z/data=!4m6!3m5!1s0x163101db1195c6e7:0x10209694f03469cc!8m2!3d9.6048717!4d41.8585081!16zL20vMDRsajV5?entry=ttu&g_ep=EgoyMDI2MDgwNS4xIKXMDSoASAFQAw%3D%3D';

const DIRE_DAWA_NEIGHBORHOODS_MAP: Record<
  string,
  { x: number; y: number; zone: string; lat: number; lng: number }
> = {
  'ከዚራ': { x: 420, y: 260, zone: 'መካከለኛው ድሬዳዋ (Kezira)', lat: 9.6048, lng: 41.8585 },
  'መጋላ': { x: 480, y: 290, zone: 'ታሪካዊ ከተማ (Megala)', lat: 9.598, lng: 41.865 },
  'ደቻቱ': { x: 520, y: 240, zone: 'ደቻቱ ወንዝ ተፋሰስ (Dechatu)', lat: 9.602, lng: 41.862 },
  'ሳቢያን': { x: 340, y: 220, zone: 'ሰሜናዊ ድሬዳዋ (Sabian)', lat: 9.615, lng: 41.848 },
  'አዲስ ከተማ': { x: 380, y: 320, zone: 'ደቡባዊ ድሬዳዋ (Addis Ketema)', lat: 9.59, lng: 41.852 },
  'ግሪክ ካምፕ': { x: 300, y: 280, zone: 'ምዕራባዊ ዞን (Greek Camp)', lat: 9.6, lng: 41.84 },
  'ገንደ ቆሬ': { x: 450, y: 360, zone: 'ደቡብ ምዕራብ (Gende Kore)', lat: 9.585, lng: 41.855 },
  'መብረት ኃይል': { x: 260, y: 230, zone: 'ሰሜን ምዕራብ (Mebrat Hail)', lat: 9.618, lng: 41.835 },
  'ገንደ ቦዬ': { x: 580, y: 210, zone: 'ሰሜን ምስራቅ (Gende Boye)', lat: 9.612, lng: 41.872 },
  'ገንደ ዶቄ': { x: 550, y: 310, zone: 'ምስራቃዊ ዞን (Gende Doke)', lat: 9.592, lng: 41.868 },
  'ገንደ ሎኒ': { x: 620, y: 260, zone: 'ምስራቅ ድሬዳዋ (Gende Loni)', lat: 9.605, lng: 41.88 },
  'ገንደ ዲፖ': { x: 400, y: 200, zone: 'ሰሜን መካከለኛ (Gende Dipo)', lat: 9.61, lng: 41.856 },
  'ነምበር ዋን': { x: 360, y: 380, zone: 'ደቡባዊ ዞን (Number One)', lat: 9.58, lng: 41.848 },
  'ቀብረ ጆሌ': { x: 650, y: 340, zone: 'ደቡብ ምስራቅ (Kebre Jole)', lat: 9.588, lng: 41.885 },
  'ጫት ተራ': { x: 490, y: 340, zone: 'ማዕከላዊ ገበያ (Chat Tera)', lat: 9.595, lng: 41.861 },
  'ሐፈተ ኢሳ': { x: 240, y: 330, zone: 'ምዕራብ ገጠር (Hafate Isa)', lat: 9.582, lng: 41.828 },
  'ለገ ሐሬ': { x: 580, y: 380, zone: 'ደቡብ ምስራቅ ገጠር (Lege Hare)', lat: 9.578, lng: 41.875 },
  'ፖሊስ መሬት': { x: 320, y: 160, zone: 'ሰሜናዊ አቅጣጫ (Police Meret)', lat: 9.625, lng: 41.845 },
  'ገንደ ገራዳ': { x: 680, y: 220, zone: 'ምስራቅ ገጠር (Gende Gerada)', lat: 9.615, lng: 41.892 },
  'ብሄረ ጽጌ': { x: 440, y: 150, zone: 'ሰሜን መካከለኛ (Behere Tsige)', lat: 9.622, lng: 41.86 },
  'አላይ በዴ': { x: 720, y: 300, zone: 'ምስራቅ ጫፍ (Alai Bede)', lat: 9.598, lng: 41.902 },
  'መላካ ጀብዱ': { x: 750, y: 180, zone: 'መላካ ጀብዱ ገጠር (Melka Jebdu)', lat: 9.63, lng: 41.92 },
  'ገንደ ተስፋ': { x: 280, y: 400, zone: 'ደቡብ ምዕራብ (Gende Tesfa)', lat: 9.572, lng: 41.838 },
  'ገንደ ካባ': { x: 500, y: 160, zone: 'ሰሜናዊ ዞን (Gende Kaba)', lat: 9.62, lng: 41.868 },
  'ገንደ ሮቃ': { x: 600, y: 150, zone: 'ሰሜን ምስራቅ (Gende Roka)', lat: 9.624, lng: 41.882 },
  'ገንደ ጋራ': { x: 200, y: 250, zone: 'ምዕራብ ጫፍ (Gende Gara)', lat: 9.608, lng: 41.82 },
  'ገንደ ገበሬ': { x: 180, y: 360, zone: 'ገጠር ወረዳ (Gende Gebere)', lat: 9.575, lng: 41.815 },
};

export const DireDawaMapVisual: React.FC<DireDawaMapVisualProps> = ({
  residenceData,
  totalResponses,
}) => {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>('ከዚራ');
  const [searchTerm, setSearchTerm] = useState('');
  const [mapMode, setMapMode] = useState<'google' | 'satellite' | 'svg'>('google');
  const [zoomLevel, setZoomLevel] = useState<number>(15);

  // Map residence array to dict
  const residenceMap = (residenceData || []).reduce(
    (acc: Record<string, { count: number; percentage: number }>, item) => {
      acc[item.label] = { count: item.count, percentage: item.percentage };
      return acc;
    },
    {}
  );

  const filteredData = (residenceData || []).filter((r) =>
    r.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeStats = selectedNeighborhood
    ? residenceMap[selectedNeighborhood] || { count: 0, percentage: 0 }
    : null;

  const currentCoords = selectedNeighborhood && DIRE_DAWA_NEIGHBORHOODS_MAP[selectedNeighborhood]
    ? DIRE_DAWA_NEIGHBORHOODS_MAP[selectedNeighborhood]
    : { lat: 9.6048717, lng: 41.8585081 };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 1, 19));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 1, 12));
  const handleResetZoom = () => setZoomLevel(15);

  // Dynamic Google Maps Embed URL based on zoomLevel, mode, and coords
  const embedMapUrl =
    mapMode === 'satellite'
      ? `https://maps.google.com/maps?q=${currentCoords.lat},${currentCoords.lng}&t=k&z=${zoomLevel}&ie=UTF8&iwloc=&output=embed`
      : `https://maps.google.com/maps?q=${currentCoords.lat},${currentCoords.lng}&z=${zoomLevel}&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-lg space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center font-bold border border-amber-500/20 shrink-0">
            <MapIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <span>የድሬዳዋ አስተዳደር የነዋሪዎች አስተያየት በሰፈሮችና በክፍለ ከተማ ካርታ</span>
              <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                Dire Dawa Interactive Map
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              የድሬዳዋ ከተማና የገጠር ቀበሌዎች የህዝብ ተሳትፎ ስርጭት በካርታ (Live Geographic Map)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700">
            <Users className="w-4 h-4 text-blue-600" />
            <span>ጠቅላላ ተሳታፊ፡ <strong className="text-blue-700">{totalResponses}</strong> ነዋሪዎች</span>
          </div>
        </div>
      </div>

      {/* Mode Selector & Map Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white p-3 rounded-2xl border border-slate-800 shadow-md text-xs font-bold">
        {/* Mode Switcher */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setMapMode('google')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              mapMode === 'google'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>Google Map View</span>
          </button>

          <button
            onClick={() => setMapMode('satellite')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              mapMode === 'satellite'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>ሳተላይት View</span>
          </button>

          <button
            onClick={() => setMapMode('svg')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              mapMode === 'svg'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>የሰፈሮች ተሳትፎ Pins</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-2">
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            Zoom: <strong>{zoomLevel}x</strong>
          </span>

          <button
            onClick={handleZoomIn}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4 text-emerald-400" />
          </button>

          <button
            onClick={handleZoomOut}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4 text-amber-400" />
          </button>

          <button
            onClick={handleResetZoom}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="w-4 h-4 text-sky-400" />
          </button>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Neighborhood Detail Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Visual Dire Dawa Map Container (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950 rounded-3xl p-3 sm:p-5 border border-slate-800 text-white relative overflow-hidden shadow-2xl">
          {/* Top Location Bar */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3 text-xs">
            <div className="flex items-center space-x-2 text-amber-400 font-bold">
              <Navigation className="w-4 h-4 animate-spin-slow" />
              <span>ድሬዳዋ አስተዳደር (Dire Dawa, Ethiopia)</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              GPS: {currentCoords.lat.toFixed(4)}° N, {currentCoords.lng.toFixed(4)}° E
            </span>
          </div>

          {/* Interactive Google Map Embed View */}
          {mapMode !== 'svg' ? (
            <div className="relative w-full aspect-[16/10] bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-inner">
              <iframe
                title="Dire Dawa Interactive Google Map"
                src={embedMapUrl}
                className="w-full h-full border-0 rounded-2xl"
                loading="lazy"
                allowFullScreen
              />
              <div className="absolute top-3 left-3 bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] text-amber-300 font-bold shadow-md">
                📍 {selectedNeighborhood || 'ድሬዳዋ ከተማ'}
              </div>
            </div>
          ) : (
            /* SVG Pin Node Map Display */
            <div className="relative w-full aspect-[16/10] bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center">
              {/* Background Map Grid Pattern */}
              <svg className="absolute inset-0 w-full h-full opacity-15" width="100%" height="100%">
                <defs>
                  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-400" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* Stylized Dire Dawa SVG Canvas */}
              <svg viewBox="0 0 900 500" className="w-full h-full p-4">
                {/* Dechatu River Path */}
                <path
                  d="M 520 80 Q 510 200 480 300 T 450 480"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="4"
                  strokeDasharray="6 3"
                  className="opacity-60"
                />
                <text x="500" y="100" fill="#38bdf8" fontSize="10" fontWeight="bold" opacity="0.7">
                  ~ ደቻቱ ወንዝ (Dechatu River) ~
                </text>

                {/* Railway Line */}
                <path
                  d="M 100 260 L 800 260"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeDasharray="8 4"
                  className="opacity-50"
                />
                <text x="700" y="250" fill="#fbbf24" fontSize="9" fontWeight="bold" opacity="0.8">
                  🚂 የኢትዮ-ጅቡቲ ምድር ባቡር
                </text>

                {/* Render Neighborhood Nodes on Map */}
                {Object.entries(DIRE_DAWA_NEIGHBORHOODS_MAP).map(([name, coords]) => {
                  const data = residenceMap[name] || { count: 0, percentage: 0 };
                  const isSelected = selectedNeighborhood === name;
                  const radius = Math.max(10, Math.min(26, 12 + data.percentage * 0.8));

                  return (
                    <g
                      key={name}
                      transform={`translate(${coords.x}, ${coords.y})`}
                      onClick={() => setSelectedNeighborhood(name)}
                      className="cursor-pointer group"
                    >
                      {/* Glowing outer aura for high response rate */}
                      {data.count > 0 && (
                        <circle
                          r={radius + 8}
                          className={`transition-all ${
                            isSelected
                              ? 'fill-amber-400/30 animate-ping'
                              : 'fill-blue-500/20 group-hover:fill-blue-400/30'
                          }`}
                        />
                      )}

                      {/* Node Circle */}
                      <circle
                        r={radius}
                        className={`transition-all stroke-2 ${
                          isSelected
                            ? 'fill-amber-400 stroke-white shadow-xl scale-110'
                            : data.count > 0
                            ? 'fill-blue-600 stroke-blue-300 group-hover:fill-blue-500'
                            : 'fill-slate-800 stroke-slate-600 group-hover:fill-slate-700'
                        }`}
                      />

                      {/* Pin Icon / Label inside node */}
                      <text
                        textAnchor="middle"
                        dy=".3em"
                        fill={isSelected ? '#0f172a' : '#ffffff'}
                        fontSize={radius > 16 ? '10' : '8'}
                        fontWeight="bold"
                      >
                        {data.count > 0 ? `${data.count}` : '•'}
                      </text>

                      {/* Text Label Below Node */}
                      <text
                        textAnchor="middle"
                        y={radius + 14}
                        fill={isSelected ? '#fbbf24' : '#e2e8f0'}
                        fontSize="10"
                        fontWeight={isSelected ? '900' : '600'}
                        className="drop-shadow-md select-none"
                      >
                        {name}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Bottom Floating Legend */}
              <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-300">
                <div className="flex items-center space-x-3">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-amber-400 inline-block border border-white"></span> የተመረጠ
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span> ተሳትፎ ያለው ሰፈር
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-slate-800 inline-block border border-slate-600"></span> ገና አልተመለሰም
                  </span>
                </div>
                <span className="text-amber-400 font-bold">27 የድሬዳዋ ሰፈሮች</span>
              </div>
            </div>
          )}
        </div>

        {/* Neighborhood Breakdown & List Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Selected Neighborhood Focus Box */}
          {selectedNeighborhood && (
            <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white p-5 rounded-2xl border border-blue-700/60 shadow-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  {DIRE_DAWA_NEIGHBORHOODS_MAP[selectedNeighborhood]?.zone || 'ድሬዳዋ ሰፈር'}
                </span>
                <MapPin className="w-4 h-4 text-amber-400" />
              </div>
              <h4 className="text-lg font-black text-white">{selectedNeighborhood}</h4>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-800/80 text-xs">
                <div>
                  <span className="text-slate-300 text-[11px]">የተሰጠ አስተያየት፡</span>
                  <p className="text-base font-black text-amber-300">{activeStats?.count || 0} ነዋሪዎች</p>
                </div>
                <div>
                  <span className="text-slate-300 text-[11px]">ድርሻ (Percentage)፡</span>
                  <p className="text-base font-black text-emerald-400">{activeStats?.percentage || 0}%</p>
                </div>
              </div>
            </div>
          )}

          {/* Neighborhood Search & Interactive List */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">የሰፈሮች ዝርዝር (Sub-cities List)</span>
              <span className="text-[10px] text-slate-500 font-semibold">{filteredData.length} ሰፈሮች</span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ሰፈር ፈልግ (ለምሳሌ፡ ከዚራ, መጋላ)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {filteredData.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">ምንም የተገኘ ሰፈር የለም</p>
              ) : (
                filteredData.map((item) => {
                  const isSelected = selectedNeighborhood === item.label;
                  return (
                    <button
                      key={item.label}
                      onClick={() => setSelectedNeighborhood(item.label)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-slate-900 text-amber-300 shadow-md'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-blue-500'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0 font-mono">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                          {item.count}
                        </span>
                        <span className="text-emerald-600 text-[10px]">{item.percentage}%</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
