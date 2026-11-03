/**
 * Pennsylvania's 20 state forests (DCNR), one forecast point each.
 *
 * Coordinates are each forest's Wikipedia infobox point (checked 2026-11-03);
 * counties from Wikipedia's "List of Pennsylvania state forests". Renames to
 * know about: Lackawanna → Pinchot (2015), Kittanning → Clear Creek (2007),
 * Valley Forge → William Penn (2007); Wyoming merged into Loyalsock (2005).
 *
 * DCNR's per-forest pages moved to pa.gov and their new addresses 404'd when
 * probed, so every card links to DCNR's "Find a Forest" page, which answered.
 */
export type StateForest = {
  name: string;
  area: string; // counties
  lat: number;
  lng: number;
  url: string;
};

const DCNR = "https://www.pa.gov/agencies/dcnr/recreation/where-to-go/state-forests/find-a-forest";

const f = (name: string, area: string, lat: number, lng: number): StateForest => ({
  name: `${name} State Forest`,
  area,
  lat,
  lng,
  url: DCNR,
});

// Northeast first (closest to the NorthEDM home region), then roughly east → west.
export const PA_STATE_FORESTS: StateForest[] = [
  f("Pinchot", "Lackawanna, Luzerne, Wayne, Wyoming", 41.56944, -75.70833),
  f("Delaware", "Pike, Monroe", 41.12333, -75.16639),
  f("Weiser", "Carbon, Columbia, Dauphin, Northumberland, Schuylkill", 40.63028, -76.19306),
  f("Loyalsock", "Bradford, Lycoming, Sullivan", 41.51083, -76.72028),
  f("William Penn", "Berks, Bucks, Chester, Delaware, Lancaster", 39.72389, -76.10111),
  f("Tioga", "Bradford, Lycoming, Tioga", 41.77694, -77.51389),
  f("Tiadaghton", "Clinton, Lycoming, Potter, Tioga, Union", 41.31472, -77.38444),
  f("Tuscarora", "Cumberland, Franklin, Huntingdon, Juniata, Mifflin, Perry", 40.33722, -77.51056),
  f("Michaux", "Adams, Cumberland, Franklin", 39.91194, -77.56361),
  f("Bald Eagle", "Centre, Clinton, Mifflin, Union, Snyder", 40.88778, -77.65611),
  f("Sproul", "Cameron, Centre, Clinton, Lycoming, Potter", 41.32778, -77.74944),
  f("Rothrock", "Centre, Huntingdon, Mifflin", 40.71, -77.81833),
  f("Susquehannock", "Clinton, McKean, Potter", 41.77389, -78.01861),
  f("Elk", "Cameron, Clinton, Elk, McKean, Potter", 41.33333, -78.29139),
  f("Buchanan", "Bedford, Franklin, Fulton", 39.83194, -78.54833),
  f("Moshannon", "Cameron, Centre, Clearfield, Clinton, Elk", 41.20833, -78.57556),
  f("Gallitzin", "Bedford, Cambria, Indiana, Somerset", 40.20833, -78.70806),
  f("Clear Creek", "Clarion, Forest, Jefferson, Mercer, Venango", 41.32056, -79.05611),
  f("Cornplanter", "Crawford, Forest, Warren", 41.87417, -79.15222),
  f("Forbes", "Fayette, Somerset, Westmoreland", 40.21194, -79.19778),
];
