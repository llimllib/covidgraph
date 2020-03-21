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

capita = {
  Italy: 60317546,
  Alabama: 4830620,
  Alaska: 733375,
  Arizona: 6641928,
  Arkansas: 2958208,
  California: 38421464,
  Colorado: 5278906,
  Connecticut: 3593222,
  Delaware: 926454,
  "District of Columbia": 647484,
  Florida: 19645772,
  Georgia: 10006693,
  Hawaii: 1406299,
  Idaho: 1616547,
  Illinois: 12873761,
  Indiana: 6568645,
  Iowa: 3093526,
  Kansas: 2892987,
  Kentucky: 4397353,
  Louisiana: 4625253,
  Maine: 1329100,
  Maryland: 5930538,
  Massachusetts: 6705586,
  Michigan: 9900571,
  Minnesota: 5419171,
  Mississippi: 2988081,
  Missouri: 6045448,
  Montana: 1014699,
  Nebraska: 1869365,
  Nevada: 2798636,
  "New Hampshire": 1324201,
  "New Jersey": 8904413,
  "New Mexico": 2084117,
  "New York": 19673174,
  "North Carolina": 9845333,
  "North Dakota": 721640,
  Ohio: 11575977,
  Oklahoma: 3849733,
  Oregon: 3939233,
  Pennsylvania: 12779559,
  "Rhode Island": 1053661,
  "South Carolina": 4777576,
  "South Dakota": 843190,
  Tennessee: 6499615,
  Texas: 26538614,
  Utah: 2903379,
  Vermont: 626604,
  Virginia: 8256630,
  Washington: 6985464,
  "West Virginia": 1851420,
  Wisconsin: 5742117,
  Wyoming: 579679,
  "Puerto Rico": 3583073,
  "South Korea": 51709098
};

// intentionally global. Let's let users play with it in the console if they want
covidData = undefined;

fetchData = async () => {
  covidData = await d3.csv("./time_series_19-covid-Confirmed.csv", row => {
    if (row["Country/Region"] == "Korea, South") {
      row["Country/Region"] = "South Korea";
    }

    let values = [];

    for (var prop in row) {
      if (Object.prototype.hasOwnProperty.call(row, prop)) {
        // Province/State and Country/Region fields are string. Everything
        // else is numeric.
        if (prop.startsWith("Provi") || prop.startsWith("Country")) {
          continue;
        }

        const name = row["Province/State"] || row["Country/Region"];
        row.name = name;
        if (row["Province/State"]) {
          row.displayName = `${row["Province/State"]}, ${
            row["Country/Region"]
          }`;
        }

        // convert each field to a number
        row[prop] = +row[prop];

        // If the field is a date, parse it and find out if it's the min or max
        // date and if it's the largest value in the dataset. Finally, add it
        // to the values array. (We'll use this for graphing)
        const parts = prop.split("/");
        if (parts.length == 3) {
          dt = new Date(+("20" + parts[2]), +parts[0] - 1, +parts[1]);

          // We're going to graph the reported incidences per 10k people
          const percapita = (row[prop] / capita[name]) * 10000;
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
};

// regions is a list of regions to graph. the region names must match a
// covidData.name exactly
graph = async regions => {
  // TODO: better starting point? This is pretty arbitrarily chosen
  const startdt = new Date(2020, 1, 21);
  const data = covidData.filter(d => regions.indexOf(d.name) != -1);
  const maxdt = d3.max(data[0].values, d => d.dt);
  const maxval = d3.max(data, row => d3.max(row.values.map(d => d.value)));

  console.log(data);

  const margin = { top: 10, right: 30, bottom: 30, left: 60 },
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

  // append the svg object to the body of the page
  const svg = d3
    .select("#graph")
    .append("svg")
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

  // for every state/nation, create a line
  data.forEach((row, idx) => {
    // 10 categorical colors. 10 lines seems like a reasonable max we can
    // display on the graph?
    const color = d3.schemeCategory10[idx];
    svg
      .append("path")
      .datum(row.values)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 1.5)
      .attr(
        "d",
        d3
          .line()
          .x(function(d) {
            return x(d.dt);
          })
          .y(function(d) {
            return y(d.value);
          })
      );
  });
};

main = async () => {
  await fetchData();
  await graph([
    "Italy",
    "South Korea",
    "California",
    "Washington",
    "New York",
    "New Jersey",
    "Maine"
  ]);
};

window.addEventListener("DOMContentLoaded", evt => {
  main();
});
