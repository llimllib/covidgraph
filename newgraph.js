// TODO: configurable starting point?
// TODO: permalinks that allow sharing of a graph with a particular country set
// or axis type
// TODO: plot new case rate?
//
// intentionally global. Let's let users play with it in the console if they want
rawData = undefined;

// activeRegions must match the displayName of a covidData row
let activeRegions = [
  "Italy",
  "New York, US",
  "Washington, US",
  "South Korea",
  "California, US",
  "New Jersey, US",
  "Maine, US",
];

// We want to keep colors consistent when changing the activeRegions map, so
// maintain a parallel list of colors. When we remove elt `i` from
// activeRegions, we must move elt `i` of activeColors to inactiveColors. When
// we add to activeRegions, we must move a color from inactiveColors to
// activeColors
let activeColors = d3.schemeCategory10.slice(0, activeRegions.length);
let inactiveColors = d3.schemeCategory10.slice(activeRegions.length);

// start at March 1
const startdt = new Date(2020, 2, 1);

fetchData = async () => {
  rawData = await d3.json("./data.json");

  // calculate per capita of confirmed cases
  for (let [name, data] of Object.entries(rawData)) {
    if (capita.hasOwnProperty(name)) {
      data.confirmedPerCapita = [];
      data.confirmed.forEach((confirmed) => {
        data.confirmedPerCapita.push((confirmed / capita[name]) * 10000);
      });
    }
  }
};

buildTable = () => {
  const inactiveRegions = d3
    .keys(rawData)
    .filter((d) => activeRegions.indexOf(d) == -1);

  const inactiveCountries = inactiveRegions
    .filter((d) => d.indexOf(", US") == -1)
    .slice(0, 55);
  const inactiveStates = inactiveRegions.filter((d) => d.indexOf(", US") != -1);

  d3.select("#countries ul")
    .selectAll("li.region")
    .data(inactiveCountries, (d) => d)
    .join("li")
    .attr("class", "region")
    .on("click", addHandler)
    .html((d) => `<a href="#" class="add" data-name="${d}">${d} >></a>`);

  d3.select("#states ul")
    .selectAll("li.region")
    .data(inactiveStates, (d) => d)
    .join("li")
    .attr("class", "region")
    .on("click", addHandler)
    .html((d) => `<a href="#" class="add" data-name="${d}">${d} >></a>`);

  d3.select("#selectedRegions ul")
    .selectAll("li.activeRegion")
    .data(activeRegions, (d) => d)
    .join("li")
    .attr("class", "activeRegion")
    .on("click", removeHandler)
    .html((d) => `<a href="#" class="rem" data-name="${d}">${d} <<</a>`);
};

addHandler = (name) => {
  d3.event.preventDefault();

  if (activeRegions.length < 10) {
    activeRegions.push(name);
    activeColors.push(inactiveColors.shift());
  }
  buildTable();
  // graph();
};

removeHandler = (name) => {
  d3.event.preventDefault();

  // remove the region from activeRegions and remove its color from
  // activeColors, and return it to the color pool
  const idx = activeRegions.indexOf(name);
  activeRegions.splice(idx, 1);
  inactiveColors.push(activeColors[idx]);
  activeColors.splice(idx, 1);
  buildTable();
  // graph();
};

main = async () => {
  await fetchData();
  buildTable();
};

window.addEventListener("DOMContentLoaded", (evt) => {
  main();
});
