export type CeramicGoal = 'all' | 'bodies' | 'slips' | 'glazes' | 'textures';
export type MaterialGuide = {
  id: string;
  name: string;
  color: string;
  goals: Exclude<CeramicGoal, 'all'>[];
  keywords: string;
  where: string;
  uses: string;
  trial: string;
  caution: string;
  matches: RegExp;
  source: { label: string; url: string };
};

export const GOALS: { id: CeramicGoal; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'bodies', label: 'Pastas' },
  { id: 'slips', label: 'Engobes' },
  { id: 'glazes', label: 'Esmaltes' },
  { id: 'textures', label: 'Texturas' },
];

const wildClay = { label: 'Matt Fishman · Tierras y esmaltes locales', url: 'https://ceramicartsnetwork.org/ceramics-monthly/ceramics-monthly-article/wild-clay-and-glaze' };
const glazeMaterials = { label: 'Ceramic Arts Network · Materias primas', url: 'https://ceramicartsnetwork.org/daily/article/understanding-clay-and-glaze-materials-you-dont-have-to-be-a-super-genius/' };

export const MATERIALS: MaterialGuide[] = [
  {
    id: 'clay', name: 'Arcillas y sedimentos finos', color: '#b87050',
    goals: ['bodies', 'slips', 'glazes'], keywords: 'Arcilla · lutita · limolita',
    where: 'Localiza unidades con arcillas en MAGNA o indicios de arcilla en BDMIN. Comprueba el material del lugar: una unidad puede mezclar varios tipos de tierra.',
    uses: 'Pasta si tiene plasticidad y resiste la cocción; engobe si encaja con tu soporte. Algunas arcillas también pueden entrar en un esmalte.',
    trial: 'Tamiza una muestra, forma un pequeño cuenco y registra secado, contracción y cocción en una bandeja recolectora.',
    caution: 'El color y la textura en crudo no indican su temperatura de maduración.',
    matches: /arcill|lutita|limolita/,
    source: wildClay,
  },
  {
    id: 'ochre', name: 'Tierras ferruginosas y ocres', color: '#a7492e',
    goals: ['slips', 'glazes', 'textures'], keywords: 'Ocre · hierro · tierra ferruginosa',
    where: 'Busca indicios de ocre o hierro. El Atlas Geoquímico ayuda a comparar zonas, pero no mide el hierro de la muestra que recojas.',
    uses: 'Color en engobes y esmaltes. El hierro puede aportar tonos marrones o verdes, según la receta y la cocción.',
    trial: 'Compara probetas con y sin la tierra en un mismo engobe o esmalte base. Anota la proporción, el soporte y la atmósfera.',
    caution: 'Una tierra roja puede contener hierro, pero el color no permite calcular su cantidad ni su pureza.',
    matches: /ferrugin|oxidos? de hierro|hematit|limonit|goethit|ocre/,
    source: glazeMaterials,
  },
  {
    id: 'volcanic', name: 'Rocas volcánicas', color: '#4e565a',
    goals: ['glazes', 'textures'], keywords: 'Basalto · piroclasto · lava',
    where: 'Comprueba las unidades volcánicas de MAGNA. En Campo de Calatrava hay materiales volcánicos; distingue roca fresca y tierra alterada.',
    uses: 'El basalto puede aportar color a esmaltes: un estudio obtuvo tonos crema y beige. Habría que ensayar los materiales locales y cada base.',
    trial: 'Compara una base conocida sin adición y pequeñas probetas con material molido. Registra color, superficie, burbujas y ajuste al soporte.',
    caution: 'Una roca volcánica no es necesariamente una arcilla. El mapa no garantiza una composición ni un efecto de tipo lava.',
    matches: /basalt|volcan|piroclast|lava|hidromagm|basanit|nefelinit/,
    source: { label: 'Estudio · Basalto como colorante de esmaltes', url: 'https://www.rsd.tfbor.bg.ac.rs/index.php/home/article/view/95' },
  },
  {
    id: 'feldspar', name: 'Feldespatos y granitos', color: '#bda98c',
    goals: ['glazes', 'textures'], keywords: 'Feldespato · granito · pegmatita',
    where: 'Busca indicios de feldespato en BDMIN y unidades graníticas o pegmatitas en MAGNA. No toda arena de granito equivale a feldespato.',
    uses: 'El feldespato aporta sílice, alúmina y óxidos fundentes a un esmalte. Un granito mezcla minerales en proporciones variables.',
    trial: 'Ensaya el material por separado y en mezclas graduadas con una base conocida, siempre sobre una bandeja recolectora.',
    caution: 'Granito y feldespato comercial no son sustitutos directos. La molienda y la receta cambian el resultado.',
    matches: /feldespat|granit|pegmatit|aplit|sienit/,
    source: { label: 'Linda Bloomfield · Geología para ceramistas', url: 'https://ceramicartsnetwork.org/ceramics-monthly/ceramics-monthly-article/Technofile-Geology-for-Potters' },
  },
  {
    id: 'kaolin', name: 'Caolín y materiales caoliníticos', color: '#d5c9b5',
    goals: ['bodies', 'slips', 'glazes'], keywords: 'Caolín · caolinita · caolinítico',
    where: 'Consulta indicios de caolín en BDMIN. Una tierra blanca también puede ser caliza o yeso; comprueba su identificación.',
    uses: 'Ingrediente de pastas claras, engobes y esmaltes. El caolín es refractario; el hierro y el titanio pueden alterar su blancura.',
    trial: 'Compara plasticidad, color cocido y absorción de la muestra y de mezclas con una pasta conocida.',
    caution: 'No equivale a porcelana por sí solo. Puede requerir otros materiales para trabajar y madurar correctamente.',
    matches: /caolin|caolinit/,
    source: { label: 'Antoinette Badenhorst · Ensayos de porcelana', url: 'https://ceramicartsnetwork.org/ceramics-monthly/ceramics-monthly-article/Translucent-Porcelain-131594' },
  },
  {
    id: 'carbonates', name: 'Calizas y dolomías', color: '#a59d76',
    goals: ['glazes'], keywords: 'Caliza · calcita · dolomía',
    where: 'MAGNA sitúa unidades carbonatadas; BDMIN registra indicios y explotaciones. Su presencia no indica cuánto carbonato tiene una tierra.',
    uses: 'Aportes de calcio y, en la dolomía, magnesio a esmaltes. La dolomía puede contribuir a acabados satinados o mates según la receta.',
    trial: 'Trabaja con material identificado y finamente preparado; compara pequeñas variaciones de una receta conocida.',
    caution: 'No añadas trozos de caliza a una pasta como si fueran chamota. Las inclusiones carbonatadas requieren ensayos específicos.',
    matches: /caliza|calcita|dolomi|marga|carbonat/,
    source: { label: 'Linda Bloomfield · Carbonatos en esmaltes', url: 'https://ceramicartsnetwork.org/ceramics-monthly/ceramics-monthly-article/Technofile-Geology-for-Potters' },
  },
];

export function matchingMaterials(lithology: string | null): MaterialGuide[] {
  if (!lithology) return [];
  const normalized = lithology.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return MATERIALS.filter(material => material.matches.test(normalized));
}

export const MAP_RESOURCES = [
  {
    id: 'bdmin', name: 'Recursos minerales · BDMIN', publisher: 'IGME-CSIC',
    useful: 'Indicios y explotaciones de arcilla, caolín, feldespato y otras materias primas. Es el primer complemento que consultaría para decidir una zona.',
    limitation: 'Integrado en Tierras con puntos, filtros por materia prima y consulta de fichas. Comprueba la localización, la actualidad y el permiso de acceso y recogida.',
    url: 'https://info.igme.es/BDmin/', link: 'Abrir BDMIN',
  },
  {
    id: 'soilgrids', name: 'Proporción de arcilla · SoilGrids', publisher: 'ISRIC',
    useful: 'Estimaciones de arcilla, limo y arena a distintas profundidades. Ayuda a comparar zonas con suelo más fino.',
    limitation: 'Integrado en Tierras mediante su servicio cartográfico: capas por profundidad y estimaciones por punto. Resolución de 250 m; no identifica minerales ni garantiza plasticidad.',
    url: 'https://isric.org/explore/soilgrids', link: 'Abrir SoilGrids',
  },
  {
    id: 'geochemistry', name: 'Atlas Geoquímico de España', publisher: 'IGME-CSIC',
    useful: 'Mapas de elementos, como hierro, calcio y potasio, en suelos y sedimentos. Añaden pistas regionales para investigar materiales.',
    limitation: 'Los contenidos regionales no equivalen al análisis de tu muestra. Consulta el tipo de muestra y el método analítico de la capa.',
    url: 'https://info.igme.es/visor/', link: 'Abrir visor IGME',
  },
  {
    id: 'pnoa', name: 'Ortofotos y relieve · Iberpix', publisher: 'IGN / CNIG',
    useful: 'Fotos aéreas y mapas topográficos para examinar el terreno y planear una visita a una zona de interés geológico.',
    limitation: 'Una foto no identifica el material ni confirma que puedas acceder o recogerlo. Puedes usar las ortofotos también dentro de Tierras.',
    url: 'https://iberpix.cnig.es/', link: 'Abrir Iberpix',
  },
];
