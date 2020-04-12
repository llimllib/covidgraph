// TODO: figure out how to enable baseline matching on difference plots
//       * redo UI?
// TODO: put actual date in baseline hover
// TODO: move legend when it blocks lines (baseline && log graph)
// TODO: responsive layout

const $ = document.querySelector.bind(document);

/*global rawData:writeable d3 capita*/
rawData = undefined;

// activeRegions must match the name of a rawData key
let activeRegions = [
  "Italy",
  "New York, US",
  "Washington, US",
  "New Jersey, US",
  "Louisiana, US",
];

// We want to keep colors consistent when changing the activeRegions map, so
// maintain a parallel list of colors. When we remove elt `i` from
// activeRegions, we must move elt `i` of activeColors to inactiveColors. When
// we add to activeRegions, we must move a color from inactiveColors to
// activeColors
let activeColors = d3.schemeCategory10.slice(0, activeRegions.length);
let inactiveColors = d3.schemeCategory10.slice(activeRegions.length);

async function fetchData() {
  rawData = await d3.json("./data.json");
  rawData.dates = rawData.dates.map(parseDate);

  // calculate per capita of confirmed cases
  for (let [name, data] of Object.entries(rawData.data)) {
    if (capita.hasOwnProperty(name)) {
      data.confirmedPerCapita = [];
      data.confirmed.forEach((confirmed) => {
        data.confirmedPerCapita.push((confirmed / capita[name]) * 10000);
      });

      data.deathsPerCapita = [];
      data.deaths.forEach((deaths) => {
        data.deathsPerCapita.push((deaths / capita[name]) * 1000000);
      });
    }
  }
}

function plotType() {
  return $("#plotType").value == "confirmed"
    ? "confirmedPerCapita"
    : "deathsPerCapita";
}

function drawLegend(svg, margin, data, title) {
  const legendWidth = 140;
  const x = 40;
  const y = 10;
  const legendMargin = { top: 100, left: 20 };
  const legend = svg.append("g");

  legend
    .append("rect")
    .attr("x", legendMargin.left + x - 8)
    .attr("y", legendMargin.top)
    .attr("width", legendWidth) // todo calculate from label length?
    .attr("height", activeRegions.length * 20 + margin.top)
    .attr("id", "legendBG")
    .attr("fill", "white");

  const keys = legend.selectAll("g").data(data).join("g");

  keys
    .append("circle")
    .attr("cx", x + legendMargin.left)
    .attr("cy", (d, i) => y + legendMargin.top + 20 * i - 2) // 2 is a fudge factor. Just looks better.
    .attr("r", 4)
    .style("fill", (d, i) => activeColors[i])
    .attr("class", "legendCircle");

  keys
    .append("text")
    .attr("x", x + legendMargin.left * 2)
    .attr("y", (d, i) => y + legendMargin.top + 20 * i)
    .style("fill", "black")
    .attr("text-anchor", "left")
    .attr("alignment-baseline", "middle")
    .attr("class", "legendLabel")
    .text((d) => d.displayName);

  svg
    .append("rect")
    .attr("x", 27)
    .attr("y", 30)
    .attr("width", 270)
    .attr("height", 20)
    .attr("fill", "white");

  svg.append("text").attr("x", 30).attr("y", 50).text(title);
}

function graph() {
  if ($("#alignBaseline").checked) {
    graphBaselineAligned();
  } else if ($("#difference").checked) {
    graphDifference();
  } else {
    graphConfirmedByDate();
  }
}

function parseDate(dt) {
  const parts = dt.split("-");
  return new Date(+parts[2], +parts[0] - 1, +parts[1]);
}

// return the index of the first item that is > min
function startidx(arr, min) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > min) {
      return i;
    }
  }
  return Number.MAX_VALUE;
}

function smooth(values) {
  const smoothed = [values[0], values[0] + values[1]];
  for (let i = 2; i < values.length; i++) {
    smoothed.push((values[i] + values[i - 1] + values[i - 2]) / 3);
  }
  return smoothed;
}

function graphDifference() {
  const data = activeRegions.map((r) => rawData.data[r]);
  const type = $("#plotType").value;
  // hang a difference array off each data item
  data.forEach((d) => {
    d.difference = d[type].map(
      (x, i) => ((d[type][i + 1] - x) / capita[d.displayName]) * 1000000
    );
    // the last item is always NaN, pop it.
    d.difference.pop();

    d.smoothed = smooth(d.difference);
  });
  const isSmoothed = $("#smooth").checked;
  // find the number of days to slice off the front of the difference arrays,
  // as the first day where any of them had a |difference| > 10 (is 10 a
  // sensible number?)
  const sliceidx = d3.min(data.map((d) => startidx(d.difference, 1)));
  const startdt = rawData.dates[sliceidx + 1];
  const maxdt = d3.max(rawData.dates);
  const maxY = d3.max(
    data.map((b) => d3.max(isSmoothed ? b.smoothed : b.difference))
  );
  const minY = d3.min(data.map((b) => d3.min(b.difference)));
  // then slice off [0, sliceidx) for each difference array, and save it as "plotdata"
  const plotdata = isSmoothed
    ? data.map((d) => d.smoothed.slice(sliceidx))
    : data.map((d) => d.difference.slice(sliceidx));

  const margin = { top: 10, right: 30, bottom: 30, left: 60 },
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

  // clear the container
  d3.select("#graphContainer svg").remove();

  const svg = d3
    .select("#graphContainer")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  svg
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Add X axis: the date
  const x = d3.scaleTime().domain([startdt, maxdt]).range([0, width]);
  svg
    .append("g")
    .attr("transform", "translate(0," + (height + 10) + ")")
    .call(d3.axisBottom(x).ticks(8).tickSizeOuter(0).tickSizeInner(0))
    .call((g) => g.select(".domain").remove());

  // Add y axis: the # of confirmed cases
  // https://observablehq.com/@d3/styled-axes
  const y = $("#logscale").checked
    ? d3.scaleSymlog().domain([minY, maxY]).range([height, 0])
    : d3.scaleLinear().domain([minY, maxY]).range([height, 0]);

  svg
    .append("g")
    .attr("transform", "translate(0, 0)")
    .call(d3.axisRight(y).tickSize(width).ticks(10))
    // remove the y axis bar
    .call((g) => g.select(".domain").remove())
    // make the tick lines translucent
    .call((g) =>
      g.selectAll(".tick:not(:first-of-type) line").attr("stroke-opacity", 0.2)
    )
    // move the tick labels to the left
    .call((g) => g.selectAll(".tick text").attr("x", 4).attr("dy", -4));

  svg.on("mousemove", differenceMoved(svg, data, x, y)).on("mouseleave", left);

  const line = d3
    .line()
    .x((d) => x(d[0]))
    .y((d) => y(d[1]));

  // for every state/nation, create a line
  // example to follow: https://observablehq.com/@d3/index-chart
  svg
    .append("g")
    .attr("class", "lines")
    .selectAll("path")
    .data(plotdata)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (d, i) => activeColors[i])
    .attr("stroke-width", 1.5)
    .attr("class", "line")
    .attr("d", (d) => line(d3.zip(rawData.dates.slice(sliceidx + 1), d)));

  let title =
    type == "confirmed"
      ? "Difference in Confirmed Cases per 1 million residents"
      : "Difference in Deaths per 1 million residents";

  if (isSmoothed) {
    title = title + " (3-day average)";
  }

  drawLegend(svg, margin, data, title);
}

function graphBaselineAligned() {
  const data = activeRegions.map((r) => rawData.data[r]);
  const type = plotType();
  // hang a baseline array off each data item
  data.forEach((d) => (d.baseline = d[type].slice(startidx(d[type], 0.25))));
  const maxX = d3.max(data.map((b) => b.baseline.length));
  const maxY = d3.max(data.map((b) => d3.max(b.baseline)));

  const margin = { top: 10, right: 30, bottom: 50, left: 60 },
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

  // clear the container
  d3.select("#graphContainer svg").remove();

  const svg = d3
    .select("#graphContainer")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  svg
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  const x = d3.scaleLinear().domain([0, maxX]).range([0, width]);
  svg
    .append("g")
    .attr("transform", "translate(0," + (height + 10) + ")")
    .call(d3.axisBottom(x).ticks(8).tickSizeOuter(0).tickSizeInner(0))
    .call((g) => g.select(".domain").remove());

  // Add y axis: the # of confirmed cases
  // https://observablehq.com/@d3/styled-axes
  const y = $("#logscale").checked
    ? d3.scaleLog().domain([0.25, maxY]).range([height, 0]).base(2).clamp(true)
    : d3.scaleLinear().domain([0, maxY]).range([height, 0]);

  svg
    .append("g")
    .attr("transform", "translate(0, 0)")
    .call(d3.axisRight(y).tickSize(width).ticks(10))
    // remove the y axis bar
    .call((g) => g.select(".domain").remove())
    // make the tick lines translucent
    .call((g) =>
      g.selectAll(".tick:not(:first-of-type) line").attr("stroke-opacity", 0.2)
    )
    // move the tick labels to the left
    .call((g) => g.selectAll(".tick text").attr("x", 4).attr("dy", -4));

  svg.on("mousemove", baselineMoved(svg, data, x, y)).on("mouseleave", left);

  const line = d3
    .line()
    .x((d, i) => x(i))
    .y((d) => y(d));

  // for every state/nation, create a line
  // example to follow: https://observablehq.com/@d3/index-chart
  svg
    .append("g")
    .attr("class", "lines")
    .selectAll("path")
    .data(data.map((d) => d.baseline))
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (d, i) => activeColors[i])
    .attr("stroke-width", 1.5)
    .attr("class", "line")
    .attr("d", (d) => line(d));

  const title =
    type == "confirmedPerCapita"
      ? "Confirmed covid cases per 10,000 people"
      : "Confirmed covid deaths per 1 million people";

  drawLegend(svg, margin, data, title);

  const xtitle =
    type == "confirmedPerCapita"
      ? "Days since case rate exceeded .25 per 10,000 people"
      : "Days since deaths exceeded .25 per 1 million people";
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("text-anchor", "middle")
    .text(xtitle);
}

function graphConfirmedByDate() {
  const data = activeRegions.map((r) => rawData.data[r]);
  const maxdt = d3.max(rawData.dates);
  const type = plotType();
  const maxval = d3.max(data.map((d) => d3.max(d[type])));

  const margin = { top: 10, right: 30, bottom: 30, left: 60 },
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

  // clear the container
  d3.select("#graphContainer svg").remove();

  const svg = d3
    .select("#graphContainer")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  svg
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Add X axis: the date
  const dtparts = $("#startdate").value.split("-");
  const startdt = new Date(dtparts[0], dtparts[1] - 1, dtparts[2]);
  const x = d3.scaleTime().domain([startdt, maxdt]).range([0, width]);
  svg
    .append("g")
    .attr("transform", "translate(0," + (height + 10) + ")")
    .call(d3.axisBottom(x).ticks(8).tickSizeOuter(0).tickSizeInner(0))
    .call((g) => g.select(".domain").remove());

  // Add y axis: the # of confirmed cases
  // https://observablehq.com/@d3/styled-axes
  const y = $("#logscale").checked
    ? d3
        .scaleLog()
        .domain([0.25, maxval])
        .range([height, 0])
        .base(2)
        .clamp(true)
    : d3.scaleLinear().domain([0, maxval]).range([height, 0]);

  svg
    .append("g")
    .attr("transform", "translate(0, 0)")
    .call(d3.axisRight(y).tickSize(width).ticks(10))
    // remove the y axis bar
    .call((g) => g.select(".domain").remove())
    // make the tick lines translucent
    .call((g) =>
      g.selectAll(".tick:not(:first-of-type) line").attr("stroke-opacity", 0.2)
    )
    // move the tick labels to the left
    .call((g) => g.selectAll(".tick text").attr("x", 4).attr("dy", -4));

  svg.on("mousemove", dateMoved(svg, data, x, y)).on("mouseleave", left);

  const line = d3
    .line()
    .x((d) => x(d[0]))
    .y((d) => y(d[1]));

  // for every state/nation, create a line
  // example to follow: https://observablehq.com/@d3/index-chart
  svg
    .append("g")
    .attr("class", "lines")
    .selectAll("path")
    .data(data)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (d, i) => activeColors[i])
    .attr("stroke-width", 1.5)
    .attr("class", "line")
    .attr("d", (d) => line(d3.zip(rawData.dates, d[type])));

  const title =
    type == "confirmedPerCapita"
      ? "Confirmed Cases per 10,000 residents"
      : "Deaths per million residents";

  drawLegend(svg, margin, data, title);
}

// return the index of a given date
function dateidx(dt) {
  for (let idx = 0; idx < rawData.dates.length; idx++) {
    const d = rawData.dates[idx];
    if (d.getMonth() == dt.getMonth() && d.getDate() == dt.getDate()) {
      return idx;
    }
  }
  return -1;
}

// given an array arr, return the index of the minimum element. Returns -1 if
// every element of the array is NaN. I do not understand why d3.minIndex
// (https://github.com/d3/d3-array#minIndex) is not available to me, but it
// seems not to be.
function minidx(arr) {
  if (!arr.length) {
    return;
  }
  let min = Number.MAX_VALUE;
  let minidx = -1;
  for (let idx = 0; idx < arr.length; idx++) {
    if (!isNaN(arr[idx]) && arr[idx] < min) {
      min = arr[idx];
      minidx = idx;
    }
  }
  return minidx;
}

function differenceMoved(svg, data, xscale, yscale) {
  return () => {
    d3.event.preventDefault();
    const { x: x0, y: y0 } = svg.node().getBoundingClientRect();
    const dt = xscale.invert(d3.event.clientX - x0 - 5);
    const dt2 = new Date(dt.valueOf());
    dt2.setDate(dt.getDate() + 1);
    const val = yscale.invert(d3.event.clientY - y0);
    const idx = dateidx(dt);
    const isSmoothed = $("#smooth").checked;
    const key = isSmoothed ? "smoothed" : "difference";
    const diffs = data.map((d) => Math.abs(val - d[key][idx]));
    const type = $("#plotType").value;
    // find the closest line and show the tooltip
    const dataidx = minidx(diffs);

    // if no lines are close enough, hide the tooltip and exit
    if (
      diffs.filter((d) => d < 1000).length == 0 ||
      data[dataidx][key][idx] === undefined
    ) {
      d3.select("#hover").style("display", "none");
      return;
    }

    d3
      .select("#hover")
      .style("display", "block")
      .style("left", d3.event.pageX + 10 + "px")
      .style("top", d3.event.pageY + "px").html(`<strong>${
      data[dataidx].displayName
    }</strong><br>
${dt.toLocaleDateString()}: ${data[dataidx][type][idx]}<br>
${dt2.toLocaleDateString()}: ${data[dataidx][type][idx + 1]}<br>
difference: ${data[dataidx][type][idx + 1] - data[dataidx][type][idx]}<br>
difference per 1 million residents: ${data[dataidx].difference[idx].toFixed(
      2
    )}`);
  };
}

function baselineMoved(svg, data, xscale, yscale) {
  return () => {
    d3.event.preventDefault();
    const { x: x0, y: y0 } = svg.node().getBoundingClientRect();
    const dayn = Math.round(xscale.invert(d3.event.clientX - x0));
    const val = yscale.invert(d3.event.clientY - y0);
    const diffs = data.map((d) => Math.abs(val - d.baseline[dayn]));

    // if no lines are close enough, hide the tooltip and exit
    if (diffs.filter((d) => d < 1).length == 0) {
      d3.select("#hover").style("display", "none");
      return;
    }

    // find the closest line and show the tooltip
    const dataidx = minidx(diffs);
    // the index of the data in the non-baseline arrays can be found by
    // starting where the baseline does and adding dayn to it
    const nonBaselineIdx =
      data[dataidx].confirmed.length - data[dataidx].baseline.length + dayn;

    d3
      .select("#hover")
      .style("display", "block")
      .style("left", d3.event.pageX + 10 + "px")
      .style("top", d3.event.pageY + "px").html(`<strong>${
      data[dataidx].displayName
    }</strong><br>
Day number: ${dayn}<br>
Cases: ${data[dataidx].confirmed[nonBaselineIdx]}<br>
Deaths: ${data[dataidx].deaths[nonBaselineIdx]}<br>
Per Capita: ${data[dataidx][plotType()][nonBaselineIdx].toFixed(2)}`);
  };
}

function dateMoved(svg, data, xscale, yscale) {
  return () => {
    d3.event.preventDefault();
    const { x: x0, y: y0 } = svg.node().getBoundingClientRect();
    const dt = xscale.invert(d3.event.clientX - x0 + 20);
    const val = yscale.invert(d3.event.clientY - y0);
    const idx = dateidx(dt);
    const type = plotType();
    const choices = data.map((d) => d[type][idx]);
    const diffs = choices.map((d) => Math.abs(val - d));

    // if no lines are close enough, hide the tooltip and exit
    if (diffs.filter((d) => d < 1).length == 0) {
      d3.select("#hover").style("display", "none");
      return;
    }

    // find the closest line and show the tooltip
    const dataidx = minidx(diffs);
    d3
      .select("#hover")
      .style("display", "block")
      .style("left", d3.event.pageX + 10 + "px")
      .style("top", d3.event.pageY + "px").html(`<strong>${
      data[dataidx].displayName
    }</strong><br>
Date: ${dt.toLocaleDateString()}<br>
Cases: ${data[dataidx].confirmed[idx]}<br>
Deaths: ${data[dataidx].deaths[idx]}<br>
Per Capita: ${data[dataidx][type][idx].toFixed(2)}`);
  };
}

function left() {
  d3.select("#hover").style("display", "none");
}

function buildTable() {
  // the regions we want to list must be present in the population data and
  // have greater than 1m residents or be a US state
  const inactiveRegions = d3
    .keys(rawData.data)
    .filter(
      (d) =>
        activeRegions.indexOf(d) == -1 &&
        capita.hasOwnProperty(d) &&
        (capita[d] > 1000000 || d.indexOf(", US") != -1)
    );

  const type = plotType();
  inactiveRegions.sort((a, b) =>
    d3.max(rawData.data[a][type]) < d3.max(rawData.data[b][type]) ? 1 : -1
  );

  const inactiveCountries = inactiveRegions
    .filter((d) => d.indexOf(", US") == -1)
    .slice(0, 55);
  const inactiveStates = inactiveRegions.filter((d) => d.indexOf(", US") != -1);

  if ($("#alphabetical").checked) {
    inactiveCountries.sort((a, b) => (a < b ? -1 : 1));
    inactiveStates.sort((a, b) => (a < b ? -1 : 1));
  }

  d3.select("#countries ul")
    .selectAll("li.region")
    .data(inactiveCountries, (d) => d)
    .join("li")
    .attr("class", "region")
    .on("click", addHandler)
    .html(
      (d) =>
        `<a href="#" class="add" data-name="${d}">${d} <span class="ornament">+</span></a>`
    );

  d3.select("#states ul")
    .selectAll("li.region")
    .data(inactiveStates, (d) => d)
    .join("li")
    .attr("class", "region")
    .on("click", addHandler)
    .html(
      (d) =>
        `<a href="#" class="add" data-name="${d}">${d} <span class="ornament">+</span></a>`
    );

  d3.select("#selectedRegions ul")
    .selectAll("li.activeRegion")
    .data(activeRegions, (d) => d)
    .join("li")
    .attr("class", "activeRegion")
    .on("click", removeHandler)
    .html(
      (d) =>
        `<a href="#" class="rem" data-name="${d}">${d} <span class="ornament">×</span></a>`
    );
}

function addHandler(name) {
  d3.event.preventDefault();

  if (activeRegions.length < 10) {
    activeRegions.push(name);
    activeColors.push(inactiveColors.shift());
  }
  buildTable();
  graph();
}

function removeHandler(name) {
  d3.event.preventDefault();

  // remove the region from activeRegions and remove its color from
  // activeColors, and return it to the color pool
  const idx = activeRegions.indexOf(name);
  activeRegions.splice(idx, 1);
  inactiveColors.push(activeColors[idx]);
  activeColors.splice(idx, 1);
  buildTable();
  graph();
}

function makePermalink() {
  const state = {
    regions: activeRegions,
    plotType: $("#plotType").value,
    logscale: $("#logscale").checked,
    alignBaseline: $("#alignBaseline").checked,
    difference: $("#difference").checked,
    smooth: $("#smooth").checked,
    alphabetical: $("#alphabetical").checked,
    startdate: $("#startdate").value,
  };
  // replace the URL with a permalink
  const url = window.location.href.split("?")[0];
  window.history.replaceState(
    {},
    null,
    url + "?state=" + btoa(JSON.stringify(state))
  );
}

function loadState() {
  try {
    const state = JSON.parse(
      atob(new URLSearchParams(document.location.search).get("state"))
    );

    activeRegions = state.regions;
    activeColors = d3.schemeCategory10.slice(0, activeRegions.length);
    inactiveColors = d3.schemeCategory10.slice(activeRegions.length);
    $("#plotType").value = state.plotType;
    $("#logscale").checked = state.logscale;
    $("#alignBaseline").checked = state.alignBaseline;
    $("#difference").checked = state.difference;
    $("#smooth").checked = state.smooth;
    $("#alphabetical").checked = state.checked;
    $("#startdate").value = state.startdate;
  } catch (e) {
    return;
  }
}

function differenceChanged() {
  if ($("#difference").checked) {
    // disable start date and baseline options; enable rolling average
    d3.select("label[for=startdate]").style("color", "lightgrey");
    $("#startdate").disabled = true;
    d3.select("label[for=alignBaseline]").style("color", "lightgrey");
    $("#alignBaseline").disabled = true;
    d3.select("label[for=smooth]").style("color", "black");
    $("#smooth").disabled = false;
  } else {
    d3.select("label[for=startdate]").style("color", "black");
    $("#startdate").disabled = false;
    d3.select("label[for=alignBaseline]").style("color", "black");
    $("#alignBaseline").disabled = false;
    d3.select("label[for=smooth]").style("color", "lightgrey");
    $("#smooth").disabled = true;
  }

  graph();
}

function baselineChanged() {
  if ($("#alignBaseline").checked) {
    d3.select("label[for=startdate").style("color", "lightgrey");
    $("#startdate").disabled = true;
  } else {
    d3.select("label[for=startdate").style("color", "black");
    $("#startdate").disabled = false;
  }
  graph();
}

async function main() {
  await fetchData();

  // If there is state provided in the URL, load it
  loadState();

  buildTable();
  $("#logscale").addEventListener("change", graph);
  document
    .querySelector("#alphabetical")
    .addEventListener("change", buildTable);
  $("#alignBaseline").addEventListener("change", baselineChanged);
  $("#startdate").addEventListener("change", graph);
  $("#datadt").innerText = d3.max(rawData.dates).toLocaleDateString();
  $("#plotType").addEventListener("change", graph);
  $("#smooth").addEventListener("change", graph);
  $("#difference").addEventListener("change", differenceChanged);
  $("#permalink").addEventListener("click", makePermalink);

  differenceChanged();
  baselineChanged();

  graph();
}

window.addEventListener("DOMContentLoaded", () => {
  main();
});
