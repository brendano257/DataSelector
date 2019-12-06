# Data Selector
##### A tool for data managers and analysts for time-series quality control

Visually inspecting and filtering data points can be a large task. Fortunately,
a standardized format and a good tool are about all you need.

Data Selector allows one to plot timeseries data in an interactive format, made
specifically for filtering data. One type of data is plotted at a time, but a 
record of all selected data is maintained during a session (unless cleared purposefully).
This means one can work through dozens of plots, selecting outliers, then download
an ordered list of all dates that were selected, and what compounds were selected
for those dates. The resulting JSON is a readily readable format for automated filtering
or other data processing applications.

<h4>Quick Guide</h4>
    <h6>Also included in example/template.html</h6>
<ul>
  <li>Click a point to select it</li>
  <li>Click and drag to select all points within the box</li>
  <li>Hold alt, then drag to select all points within the box, but remove any that were previously selected</li>
  <li>Hold shift, then drag to zoom in on that area</li>
  <li>Hit Undo Zoom to go to your previous zoom</li>
  <li>Manually change the axis parameters with the fields below</li>
  <li>View the JSON output of selections below or hit 'Download JSON' to get a sorted output</li>
</ul>

### Included Example
The included example uses atmospheric trace gas data from GEOSummit, an NSF
research station on Greenland's ice sheet. See 
<a href="https://www.esrl.noaa.gov/gmd/dv/data/index.php?type=Flask&site=SUM&category=Non-Methane%2BHydrocarbons">NOAA Global Monitoring Division program</a>
to browse the data. Raw data were processed from the originals into a convenient JSON format,
and no other changes were made. 

The example can be run in a liveserver, like those available in JetBrains IDEs
(PyCharm, WebStorm, etc) or Microsoft VS Code. Simply open the template.html file
with your preferred editor's liveserver. This _does_ work in free, community versions of PyCharm and WebStorm.

#### Using your own data
Using your own data should be as easy as creating your own JSON data files with
'date' and 'value' fields, and editing 'JSONfiles' in config.js in the example to reference your 
data files. Other touch-ups, like changing the UTC offset[1], zoom limit for the x-axis, and rounding for
the y axis may be helpful.

[1] The included data uses a UTC offset of -2 (hours) because the GEOSummit data is provided
in epoch seconds calculated from datetimes in UTC-2. Change this to 0 if your data is given in UTC.
