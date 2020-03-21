//TODO y axis label
//TODO source link (data and code)
//TODO figure out how to preventDefault
//TODO hover
//TODO don't allow selecting regions already graphed

labels = (svg, colors, names, x, y) => {
  const width = 125;
  const margin = { top: 10, left: 10 };
  // legend bg
  svg
    .append("g")
    .attr("id", "legend")
    .append("rect")
    .attr("x", x)
    .attr("y", y)
    .attr("width", width) // todo calculate from label length?
    .attr("height", names.length * 20 + margin.top)
    .attr("fill", "white");

  d3.select("#legend")
    .selectAll(".legendCircle")
    .data(names)
    .enter()
    .append("circle")
    .attr("cx", x + margin.left)
    .attr("cy", (d, i) => y + margin.top + 20 * i - 2) // 2 is a fudge factor. Just looks better.
    .attr("r", 4)
    .style("fill", (d, i) => colors[i])
    .attr("class", "legendCircle");

  d3.select("#legend")
    .selectAll(".legendLabel")
    .data(names)
    .enter()
    .append("text")
    .attr("x", x + margin.left * 2)
    .attr("y", (d, i) => y + margin.top + 20 * i)
    .style("fill", "black")
    .attr("text-anchor", "left")
    .attr("alignment-baseline", "middle")
    .attr("class", "legendLabel")
    .text(d => d);
};

// TODO China and the US are not available in this data as totals. Maybe write
// a post-download-processing script?
capita = {
  Italy: 60317546,
  China: 1427647786,
  "Alabama, US": 4830620,
  "Alaska, US": 733375,
  "Arizona, US": 6641928,
  "Arkansas, US": 2958208,
  "California, US": 38421464,
  "Colorado, US": 5278906,
  "Connecticut, US": 3593222,
  "Delaware, US": 926454,
  "District of Columbia, US": 647484,
  "Florida, US": 19645772,
  "Georgia, US": 10006693,
  "Hawaii, US": 1406299,
  "Idaho, US": 1616547,
  "Illinois, US": 12873761,
  "Indiana, US": 6568645,
  "Iowa, US": 3093526,
  "Kansas, US": 2892987,
  "Kentucky, US": 4397353,
  "Louisiana, US": 4625253,
  "Maine, US": 1329100,
  "Maryland, US": 5930538,
  "Massachusetts, US": 6705586,
  "Michigan, US": 9900571,
  "Minnesota, US": 5419171,
  "Mississippi, US": 2988081,
  "Missouri, US": 6045448,
  "Montana, US": 1014699,
  "Nebraska, US": 1869365,
  "Nevada, US": 2798636,
  "New Hampshire, US": 1324201,
  "New Jersey, US": 8904413,
  "New Mexico, US": 2084117,
  "New York, US": 19673174,
  "North Carolina, US": 9845333,
  "North Dakota, US": 721640,
  "Ohio, US": 11575977,
  "Oklahoma, US": 3849733,
  "Oregon, US": 3939233,
  "Pennsylvania, US": 12779559,
  "Rhode Island, US": 1053661,
  "South Carolina, US": 4777576,
  "South Dakota, US": 843190,
  "Tennessee, US": 6499615,
  "Texas, US": 26538614,
  "Utah, US": 2903379,
  "Vermont, US": 626604,
  "Virginia, US": 8256630,
  "Washington, US": 6985464,
  "West Virginia": 1851420,
  "Wisconsin, US": 5742117,
  "Wyoming, US": 579679,
  "Puerto Rico": 3583073,
  "South Korea": 51709098
};

// intentionally global. Let's let users play with it in the console if they want
covidData = undefined;

// activeRegions must match the displayName of a covidData row
let activeRegions = [
  "Italy",
  "South Korea",
  "California, US",
  "Washington, US",
  "New York, US",
  "New Jersey, US",
  "Maine, US"
];

fetchData = async () => {
  const startdate = new Date(2020, 1, 21);

  // update the global covidData obj
  covidData = await d3.csv("./time_series_19-covid-Confirmed.csv", row => {
    // Fix any names that need to be fixed here
    if (row["Country/Region"] == "Korea, South") {
      row["Country/Region"] = "South Korea";
    }

    const name = row["Province/State"] || row["Country/Region"];
    row.name = name;

    if (row["Province/State"]) {
      row.displayName = `${row["Province/State"]}, ${row["Country/Region"]}`;
    } else {
      row.displayName = `${row["Country/Region"]}`;
    }

    // skip countries we don't have population data for
    if (!capita.hasOwnProperty(row.displayName)) {
      return undefined;
    }

    let values = [];

    for (let prop in row) {
      if (Object.prototype.hasOwnProperty.call(row, prop)) {
        // If the field is a date, parse it and add it to the values array.
        // (We'll use this for graphing)
        const parts = prop.split("/");
        if (parts.length == 3) {
          // convert each field to a number
          row[prop] = +row[prop];

          dt = new Date(+("20" + parts[2]), +parts[0] - 1, +parts[1]);
          if (dt < startdate) {
            continue;
          }

          // We're going to graph the reported incidences per 10k people
          const percapita = (row[prop] / capita[row.displayName]) * 10000;
          values.push({
            dt: dt,
            value: percapita
          });
        }
      }
    }

    // attach the values array to the row
    row.values = values;

    return row;
  });
  // Sort in order of max per-capita case rate
  covidData.sort((a, b) =>
    d3.max(a.values.map(d => d.value)) < d3.max(b.values.map(d => d.value))
      ? 1
      : -1
  );
};

graph = async => {
  // TODO: better starting point? This is pretty arbitrarily chosen
  const startdt = new Date(2020, 1, 21);
  const data = covidData.filter(
    d => activeRegions.indexOf(d.displayName) != -1
  );
  const maxdt = d3.max(data[0].values, d => d.dt);
  const maxval = d3.max(data, row => d3.max(row.values.map(d => d.value)));

  console.log(data);

  const margin = { top: 10, right: 30, bottom: 30, left: 60 },
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

  // append the svg object to the body of the page
  const svg = d3
    .select("svg#graph")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Add X axis: the date
  const x = d3
    .scaleTime()
    .domain([startdt, maxdt])
    .range([0, width]);
  svg
    .append("g")
    .attr("transform", "translate(0," + (height + 10) + ")")
    .call(
      d3
        .axisBottom(x)
        .ticks(15)
        .tickSizeOuter(0)
        .tickSizeInner(0)
    )
    .call(g => g.select(".domain").remove());

  // Add y axis: the # of confirmed cases
  // https://observablehq.com/@d3/styled-axes
  const y = d3
    .scaleLinear()
    .domain([0, maxval])
    .range([height, 0]);
  svg
    .append("g")
    .attr("transform", "translate(0, 0)")
    .call(
      d3
        .axisRight(y)
        .tickSize(width)
        .ticks(10)
    )
    // remove the y axis bar
    .call(g => g.select(".domain").remove())
    // make the tick lines translucent
    .call(g =>
      g.selectAll(".tick:not(:first-of-type) line").attr("stroke-opacity", 0.2)
    )
    // move the tick labels to the left
    .call(g =>
      g
        .selectAll(".tick text")
        .attr("x", 4)
        .attr("dy", -4)
    );

  names = data.map(row => row.name);
  labels(svg, d3.schemeCategory10, names, 30, 30);

  const line = d3
    .line()
    .x(d => x(d.dt))
    .y(d => y(d.value));

  // for every state/nation, create a line
  // example to follow: https://observablehq.com/@d3/index-chart
  svg
    .selectAll("path")
    .data(data.map(d => d.values))
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (d, i) => d3.schemeCategory10[i])
    .attr("stroke-width", 1.5)
    .attr("class", "line")
    .attr("d", d => line(d));
};

// XXX: I don't _really_ get why we get a row here even though I set the key
// function on .data to use displayName :shrug:
addHandler = row => {
  d3.event.preventDefault();

  // don't add the row if it's already present (do something better? Maybe the
  // selectable regions shouldn't include ones in the graph already.
  if (activeRegions.indexOf(row.displayName) == -1) {
    activeRegions.push(row.displayName);
  }
  buildTable();
  graph();
};

removeHandler = name => {
  d3.event.preventDefault();
  activeRegions = activeRegions.filter(x => x != name);
  buildTable();
};

buildTable = async => {
  d3.select("#allRegions ul")
    .selectAll("li.region")
    .data(covidData, d => d.displayName)
    .join("li")
    .attr("class", "region")
    .on("click", addHandler)
    .html(
      d =>
        `<a href="#" class="add" data-name="${d.displayName}">${d.displayName} >></a>`
    );

  d3.select("#selectedRegions ul")
    .selectAll("li.activeRegion")
    .data(activeRegions, d => d)
    .join(
      enter =>
        enter
          .append("li")
          .attr("class", "activeRegion")
          .on("click", removeHandler),
      update => update,
      exit => exit.remove()
    )
    .html(d => `<a href="#" class="rem" data-name="${d}">${d} <<</a>`);
};

main = async () => {
  await fetchData();
  await graph();
  await buildTable();
};

window.addEventListener("DOMContentLoaded", evt => {
  main();
});
