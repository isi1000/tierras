import { HIGUERUELA_DOCUMENTS } from './fieldSites';

export type LocalDocument = { title: string; type: 'image' | 'pdf' | 'article'; detail: string; url: string };
export type LocalDetail = { area: string; description: string; documents: LocalDocument[] };
const DETAILS: Record<string, LocalDetail> = {
  TM142: {
    area: 'Cañada–Villar · Casas de la Higueruela',
    description: 'Los planos sitúan tres afloramientos de costras y depósitos con pisolitos. La base topográfica 1:25.000 y la ortofoto mejoran la localización; el mapa geológico conserva el detalle de MAGNA.',
    documents: HIGUERUELA_DOCUMENTS.map(document => ({ ...document, type: document.type as 'image' | 'pdf' })),
  },
  TM138: {
    area: 'Poblete–Alarcos · depósitos y volcanes',
    description: 'Esquemas locales y columnas para distinguir coladas, conos, oleadas piroclásticas y capas sedimentarias dentro de una misma unidad del mapa. Las secciones son reconstrucciones de afloramientos concretos, no una capa litológica continua.',
    documents: [
      { title: 'Esquemas de los volcanes de Poblete–Alarcos', type: 'pdf', detail: 'Informe alojado por IGME, con esquemas de la cuenca y de Cabezo del Rey, fotografías y descripción de depósitos.', url: 'https://info.igme.es/ielig/documentacion/tm/tm138/documentos/d-tm138-02.pdf' },
      { title: 'Columna de depósitos hidromagmáticos', type: 'pdf', detail: 'Sección reconstruida de los anillos de tobas al sur de Poblete, junto a la N-420. Procede de la memoria MAGNA 784.', url: 'https://info.igme.es/ielig/documentacion/tm/tm138/croquis/c-tm138-01.pdf' },
      { title: 'Secciones y edad de los materiales de Poblete', type: 'pdf', detail: 'Gallardo Millán, Ancochea y Pérez-González, Geogaceta 32 (2002). Incluye secciones y correlación magnetoestratigráfica.', url: 'https://info.igme.es/ielig/documentacion/tm/tm138/documentos/d-tm138-01.pdf' },
      { title: 'Ortofoto de accesos a los sectores 1 y 3', type: 'image', detail: 'Plano IELIG con Cabezo del Rey, cantera La Alemana y Peñalagua. La situación representada corresponde a la documentación original.', url: 'https://info.igme.es/ielig/documentacion/tm/tm138/mapas%20y%20ortofotos/o-tm138-03.jpg' },
    ],
  },
  TM146: {
    area: 'Cerro Gordo–Barondillo',
    description: 'El esquema local distingue coladas, piroclastos de caída, oleadas piroclásticas y sustrato. Tiene barra de escala, pero no una escala nominal verificada; úsalo junto a los afloramientos descritos en IELIG.',
    documents: [
      { title: 'Esquema geológico de Cerro Gordo y Barondillo', type: 'image', detail: 'Esquema de Gallardo (2004) alojado por IGME: distribución local de materiales y fases eruptivas.', url: 'https://info.igme.es/ielig/documentacion/tm/tm146/croquis/c-tm146-01.jpg' },
    ],
  },
  CI240: {
    area: 'Fontanarejo · fosforitas',
    description: 'La figura 1 del estudio incluye un mapa geológico local sobre relieve LiDAR, basado en trabajo de campo y cartografía previa, además de una sección estratigráfica. No se ha verificado una escala nominal ni una precisión posicional para usarlo como capa de consulta.',
    documents: [
      { title: 'Mapa geológico local y sección de Fontanarejo', type: 'article', detail: 'Reitner y colaboradores: Revisiting the phosphorite deposit of Fontanarejo. Abre el artículo y consulta la figura 1 (mapa, ortofoto de 2019 y sección).', url: 'https://doi.org/10.1017/S001675682100087X' },
      { title: 'Informe de investigación de los fosfatos', type: 'pdf', detail: 'Proyecto de planta piloto y análisis de viabilidad (1993). Información histórica de mineralogía y análisis; no es una cartografía actual de recogida.', url: 'https://info.igme.es/sidPDF/067000/076/67076_0001.pdf' },
    ],
  },
};
export const LOCAL_STUDIES = Object.entries(DETAILS).map(([code, detail]) => ({ code, ...detail }));
export const localDetail = (code: string): LocalDetail | undefined => DETAILS[code.toUpperCase()];
export const TERRAIN_RESOURCES: LocalDocument[] = [
  { title: 'Ortofotos PNOA · actualidad y descarga', type: 'article', detail: 'Fotografía aérea para reconocer caminos y suelo expuesto. Comprueba la fecha y resolución de cada zona; no identifica minerales.', url: 'https://pnoa.ign.es/pnoa-imagen/ortofotos-pnoa-maxima-actualidad' },
  { title: 'Relieve LiDAR · productos del IGN', type: 'article', detail: 'Modelos del terreno para estudiar depresiones, laderas y excavaciones. Resolución y disponibilidad según cobertura; no aportan composición química.', url: 'https://pnoa.ign.es/pnoa-lidar/productos-a-descarga' },
];
