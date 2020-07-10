/**
 * Filenames or API endpoints to get JSON data must be defined.
 *
 * These were not typed; something like the below in Python should be helpful:
 * for file in sorted(os.listdir()):
 *  print(f'"{file.split("_")[0]}": "data/{file}",')
 */
let JSONFiles = {
  'ethane': "data/ethane.json",
  'propane': "data/propane.json",
  'i-butane': "data/i-butane.json",
  'i-pentane': "data/i-pentane.json",
  'n-butane': "data/n-butane.json",
  'n-pentane': "data/n-pentane.json"
};

// list of compounds to include (should match the keys for files/api endpoints
const compounds = Object.keys(JSONFiles);

// difference of "UTC/Epoch" times provided in JSON from real UTC
const UTCCorrection = -2;

// C formatter for time, passed to d3.timeFormat() for the x axis labels
const CTimeFormat = '%Y-%m-%d %H:%M';

// Limit to be imposed on zooming for the x-axis
const xZoomLimit = 31 * 24 * 60 * 60 * 1000;  // best-guess at a month in ms

// width of the plot
const width = 800;

// height of the plot
const height = 450;

// value to round all y-axis labels to
const yAxisRound = 50;

/**
 * Create a formatted string for the toolTip that's displayed on mouseover.
 * The plot and specific data instance are passed in by default.
 *
 * @param plot - the plot
 * @param d - data instance for this tooltip
 * @returns {string} - formatted string of the ISO date and time, removing the timezone
 */
function toolTipText(plot, d) {
    let mr = Math.floor(d.value * 100) / 100;
    return `<strong>${plot.UI.formatISODate(d.date)}<br>MR: </strong>${mr} pptv`;
}

// margins for the plot
const plotMargins = {
    top: 10,
    bottom: 75,
    right: 20,
    left: 60
};

// necessary elements in the DOM
const plotDOMElements = {
    selector: document.getElementById('compound-select'),
    header: document.getElementById('plotHeader'),
    xMin: document.getElementById('startDate'),
    xMax: document.getElementById('endDate'),
    yMin: document.getElementById('yMin'),
    yMax: document.getElementById('yMax')
};

// necessary buttons in the DOM
const DOMButtons = {
    saveSelect: document.getElementById('btn-saveSelect'),
    downloadJSON: document.getElementById('btn-downloadJSON'),
    clearPlot: document.getElementById('btn-clearPlot'),
    clearAll: document.getElementById('btn-clearAll'),
    resetAxes: document.getElementById('btn-resetAxes'),
    undoZoom: document.getElementById('btn-undoZoom')
};

// necessary CSS elements to class and format items in the DOM
const CSS = {
    canvasID: '#dataSelectorCanvas',
    selectedTextBoxID: '#selectedTextBox',
    toolTipClass: 'tooltip',
    dataPointClass: 'data-point',
    jsonTextBoxID: '#jsonTextBox',
    jsonListID: '#jsonList',
    selectedOutlierClass: 'selectedOutlier',
    axisLinesClass: 'axisLines',
    axisTextClass: 'axisText'
};

DataSelectorUI = new UIforSelector(
    compounds,
    CTimeFormat,
    UTCCorrection,
    width,
    height,
    xZoomLimit,
    yAxisRound,
    CSS,
    plotMargins,
    plotDOMElements,
    DOMButtons,
    toolTipText
);
