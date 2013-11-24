// -----------------------------------------------------------------------------
//
// Annotate Fonts v0.1.0
// Draws indexed annotations beside font layers with a legend of font names, sizes and colors
// Tested with Photoshop CS6
//
// Copyright 2013 Brandon Evans
// Released under MIT License
//
// -----------------------------------------------------------------------------

#target photoshop
#script "Annotate Fonts"
#strict on

init();
showDialog();

function showDialog() {
    var windowResource = "dialog {  \
        orientation: 'column', \
        alignChildren: ['fill', 'bottom'],  \
        preferredSize:[350, 50], \
        text: 'Annotate Fonts',  \
        margins:15, \
        \
        bottomGroup: Group{ \
            retinaCheckbox: Checkbox { text: 'Retina', value: true }, \
            cancelButton: Button { text: 'Cancel', properties:{name:'cancel'}, size: [120,24], alignment:['right', 'center'] }, \
            currentButton: Button { text: 'Current Document', properties:{name:'current'}, size: [150,24], alignment:['right', 'center'] }, \
            directoryButton: Button { text: 'Directory', properties:{name:'directory'}, size: [120,24], alignment:['right', 'center'] }, \
        }\
    }";

    var window = new Window(windowResource);

    window.bottomGroup.cancelButton.onClick = function() {
        window.close();
        return true;
    };
    window.bottomGroup.currentButton.onClick = function() {
        window.close();
        if (validateState()) {
            app.activeDocument.suspendHistory("Annotate Fonts", "annotateFonts(app.activeDocument, scale());");
        }
        return true;
    };
    window.bottomGroup.directoryButton.onClick = function() {
        window.close();
        annotateDirectory(scale());
        return true;
    };

    function scale() {
        if (window.bottomGroup.retinaCheckbox.value) {
            return 2;
        } else {
            return 1;
        }
    }

    window.show();
}

function annotateFonts(documentReference, scale) {
    // Colors used for annotation
    var orange = new SolidColor();
    orange.rgb.red = 255;
    orange.rgb.green = 127;
    orange.rgb.blue = 0;
    var white = new SolidColor();
    white.rgb.red = 255;
    white.rgb.green = 255;
    white.rgb.blue = 255;

    // Ensure the Font Annotations layer group exists
    try {
        mainLayerSet = documentReference.layerSets.getByName("Font Annotations");
    } catch (error) {
        mainLayerSet = documentReference.layerSets.add();
        mainLayerSet.name = "Font Annotations";
    }

    var allLayerIndexes = getAllLayersByIndex();
    if (allLayerIndexes.length === 0) return;

    // Iterate through all layers and collect font and layer references
    var fontArray = new Array; // List of font names
    var layerFontMap = {}; // Map from layer index to font name
    var layer, fontName;
    for (var index = 0; index < allLayerIndexes.length; ++index) {
        layerIndex = allLayerIndexes[index];
        if (validTextLayer(layerIndex)) {
            var fontInfo = getFontInfoByIndex(layerIndex);
            var fontString = fontInfo.font + ", " + (fontInfo.size / scale) + "pt, #" + fontInfo.color;
            fontArray.push(fontString);
            fontArray = fontArray.unique();
            var fontIndex = fontArray.indexOf(fontString);
            layerFontMap[layerIndex] = fontIndex;
            drawIndexAnnotation(mainLayerSet, layerIndex, fontIndex + 1, scale, orange, white);
        }
    };

    drawFontLegend(mainLayerSet, fontArray, scale, orange, white);
}

function annotateDirectory(scale) {
    var selectedFolder = Folder.selectDialog("Please select the directory of files to annotate", Folder("~"));
    if (selectedFolder == null) return;

    var psdFiles = selectedFolder.findFiles(/\.psd$|\.PSD$/);
    for (var i = 0; i < psdFiles.length; i++) {
        var document = open(psdFiles[i]);
        document.suspendHistory("Annotate Fonts", "annotateFonts(document, scale);");
    };
}

// Draw a font index annotation beside a font item layer
function drawIndexAnnotation(mainLayerSet, sourceLayerIndex, index, scale, backgroundColor, foregroundColor) {
    var layerSetRef = mainLayerSet.layerSets.add();
    var bounds = getLayerBoundsByIndex(sourceLayerIndex);
    var y1 = bounds[1];
    var x2 = bounds[2];
    var y2 = bounds[3];
    var padding = 7 * scale,
        fontSize = getFontSizeRelativeToDocument(),
        radius = fontSize;

    var shapeLayerRef = layerSetRef.artLayers.add();
    drawCircle(x2 + padding, y1 + ((y2 - y1) / 2 - radius), radius, backgroundColor);

    var textLayerRef = layerSetRef.artLayers.add();
    textLayerRef.kind = LayerKind.TEXT;
    var textItemRef = textLayerRef.textItem;
    textItemRef.kind = TextType.PARAGRAPHTEXT;
    textItemRef.position = Array(x2 + padding, y1 + ((y2 - y1) / 2 - radius));
    textItemRef.width = radius * 2;
    textItemRef.height = radius * 2;
    textItemRef.justification = Justification.CENTER;
    textItemRef.baselineShift = -(radius - fontSize / 2);
    textItemRef.contents = index;
    textItemRef.name = textItemRef.contents;
    textItemRef.color = foregroundColor;
    textItemRef.font = "LucidaGrande-Bold";
    textItemRef.size = new UnitValue(fontSize, "pt");
}

function drawFontLegend(mainLayerSet, fontArray, scale, backgroundColor, foregroundColor) {
    var layerSetRef = mainLayerSet.layerSets.add()
    var textLayerRef = layerSetRef.artLayers.add();
    textLayerRef.kind = LayerKind.TEXT;

    var textItemRef = textLayerRef.textItem;
    var fontSize = getFontSizeRelativeToDocument();;
    var padding = fontSize;
    textItemRef.position = [padding, padding];
    textItemRef.name = "Font Legend";
    textItemRef.color = foregroundColor;
    textItemRef.font = "LucidaGrande-Bold";
    textItemRef.size = new UnitValue(fontSize, "pt");

    var legendString = "";
    for (var index = 0; index < fontArray.length; ++index) {
        var fontString = fontArray[index];
        legendString = legendString + (index + 1).toString() + ": " + fontString + String.fromCharCode(13);
    }
    textItemRef.contents = legendString;

    // Add a background behind the legend
    var shapeLayerRef = layerSetRef.artLayers.add();
    shapeLayerRef.move(textLayerRef, ElementPlacement.PLACEAFTER);
    var bgBounds = boundsInset(textLayerRef.bounds, -15);
    drawRect(bgBounds, backgroundColor);
}

// -----------------------------------------------------------------------------
// Script Helpers
// -----------------------------------------------------------------------------

function validateState() {
    if (app.documents.length == 0) {
        alert("No document open");
        return false;
    }
    return true;
}

// This returns a reasonable font size based on the document size
// "Reasonable" is based on screen readibility in, say, a PDF and not necessarily at 100%
function getFontSizeRelativeToDocument() {
    return app.activeDocument.width.as("px") / 50;
}

// Layer is a text layer and is visible and opaque
// Note that the layer may still be behind other layers
function validTextLayer(layerIndex) {
    return getLayerKindByIndex(layerIndex) == LayerKind.TEXT && getLayerOpacityByIndex(layerIndex) > 0.0 && getLayerVisibleByIndex(layerIndex) == true;
}

// Return a new array of UnitValues describing bounds that have been inset
// Use a negative value to increase the bounds
function boundsInset(bounds, inset) {
    var newBounds = [
        new UnitValue(bounds[0].value + inset, bounds[0].type),
        new UnitValue(bounds[1].value + inset, bounds[1].type),
        new UnitValue(bounds[2].value - inset, bounds[2].type),
        new UnitValue(bounds[3].value - inset, bounds[3].type)
    ];
    return newBounds;
}

// -----------------------------------------------------------------------------
// Primitives Drawing
// -----------------------------------------------------------------------------

function drawCircle(left, top, radius, color) {
    var points = [
        { anchor: [left + radius, top], right: [left + radius / 2, top], left: [left + radius * 1.5, top] },
        { anchor: [left + radius * 2, top + radius], right: [left + radius * 2, top + radius / 2], left: [left + radius * 2, top + radius * 1.5] },
        { anchor: [left + radius, top + radius * 2], right: [left + radius * 1.5, top + radius * 2], left: [left + radius / 2, top + radius * 2] },
        { anchor: [left, top + radius], right: [left, top + radius * 1.5], left: [left, top + radius / 2] }
    ];
    var lineArray = [];
    for (var i = 0; i < points.length; ++i) {
        lineArray[i] = new PathPointInfo;
        lineArray[i].kind = PointKind.SMOOTHPOINT;
        lineArray[i].anchor = points[i].anchor;
        lineArray[i].leftDirection = points[i].left;
        lineArray[i].rightDirection = points[i].right;
    }

    var lineSubPathArray = new SubPathInfo();
    lineSubPathArray.closed = true;
    lineSubPathArray.operation = ShapeOperation.SHAPEADD;
    lineSubPathArray.entireSubPath = lineArray;
    var myPathItem = app.activeDocument.pathItems.add("circle", [lineSubPathArray]);

    var desc88 = new ActionDescriptor();
    var ref60 = new ActionReference();
    ref60.putClass(stringIDToTypeID("contentLayer"));
    desc88.putReference(charIDToTypeID("null"), ref60);
    var desc89 = new ActionDescriptor();
    var desc90 = new ActionDescriptor();
    var desc91 = new ActionDescriptor();
    desc91.putDouble(charIDToTypeID("Rd  "), color.rgb.red); // R
    desc91.putDouble(charIDToTypeID("Grn "), color.rgb.green); // G
    desc91.putDouble(charIDToTypeID("Bl  "), color.rgb.blue); // B
    var id481 = charIDToTypeID("RGBC");
    desc90.putObject(charIDToTypeID("Clr "), id481, desc91);
    desc89.putObject(charIDToTypeID("Type"), stringIDToTypeID("solidColorLayer"), desc90);
    desc88.putObject(charIDToTypeID("Usng"), stringIDToTypeID("contentLayer"), desc89);
    executeAction(charIDToTypeID("Mk  "), desc88, DialogModes.NO);

    myPathItem.remove();
};

function drawRect(bounds, color) {
    var x1 = bounds[0].value,
        y1 = bounds[1].value,
        x2 = bounds[2].value,
        y2 = bounds[3].value;
    var points = [
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2]
    ];
    var lineArray = [];
    for (var i = 0; i < points.length; ++i) {
        lineArray[i] = new PathPointInfo;
        lineArray[i].kind = PointKind.SMOOTHPOINT;
        lineArray[i].anchor = points[i];
        lineArray[i].leftDirection = lineArray[i].anchor;
        lineArray[i].rightDirection = lineArray[i].anchor;
    }

    var lineSubPathArray = new SubPathInfo();
    lineSubPathArray.closed = true;
    lineSubPathArray.operation = ShapeOperation.SHAPEADD;
    lineSubPathArray.entireSubPath = lineArray;
    var myPathItem = app.activeDocument.pathItems.add("circle", [lineSubPathArray]);

    var desc88 = new ActionDescriptor();
    var ref60 = new ActionReference();
    ref60.putClass(stringIDToTypeID("contentLayer"));
    desc88.putReference(charIDToTypeID("null"), ref60);
    var desc89 = new ActionDescriptor();
    var desc90 = new ActionDescriptor();
    var desc91 = new ActionDescriptor();
    desc91.putDouble(charIDToTypeID("Rd  "), color.rgb.red); // R
    desc91.putDouble(charIDToTypeID("Grn "), color.rgb.green); // G
    desc91.putDouble(charIDToTypeID("Bl  "), color.rgb.blue); // B
    var id481 = charIDToTypeID("RGBC");
    desc90.putObject(charIDToTypeID("Clr "), id481, desc91);
    desc89.putObject(charIDToTypeID("Type"), stringIDToTypeID("solidColorLayer"), desc90);
    desc88.putObject(charIDToTypeID("Usng"), stringIDToTypeID("contentLayer"), desc89);
    executeAction(charIDToTypeID("Mk  "), desc88, DialogModes.NO);

    myPathItem.remove();
};

// -----------------------------------------------------------------------------
// Layer Methods by Index
// Avoids working with the Photoshop DOM for speed
// -----------------------------------------------------------------------------

function getLayerKindByIndex(index) {
    var ref, desc, adjustmentDesc, layerSectionType;
   ref = new ActionReference();
   ref.putIndex(charIDToTypeID( "Lyr " ), index );
   desc =  executeActionGet(ref);
   if( desc.hasKey( stringIDToTypeID( 'textKey' ) ) ) return LayerKind.TEXT;
   if( desc.hasKey( stringIDToTypeID( 'smartObject' ) ) ) return LayerKind.SMARTOBJECT;// includes LayerKind.VIDEO
   if( desc.hasKey( stringIDToTypeID( 'layer3D' ) ) ) return LayerKind.LAYER3D;
   if( desc.hasKey( stringIDToTypeID( 'adjustment' ) ) ){
      switch(typeIDToStringID(desc.getList (stringIDToTypeID('adjustment')).getClass (0))){
      case 'photoFilter' : return LayerKind.PHOTOFILTER;
      case 'solidColorLayer' : return LayerKind.SOLIDFILL;
      case 'gradientMapClass' : return LayerKind.GRADIENTMAP;
      case 'gradientMapLayer' : return LayerKind.GRADIENTFILL;
      case 'hueSaturation' : return LayerKind.HUESATURATION;
      case 'colorLookup' : return undefined; //this does not exist and errors with getting layer kind
      case 'colorBalance' : return LayerKind.COLORBALANCE;
      case 'patternLayer' : return LayerKind.PATTERNFILL;
      case 'invert' : return LayerKind.INVERSION;
      case 'posterization' : return LayerKind.POSTERIZE;
      case 'thresholdClassEvent' : return LayerKind.THRESHOLD;
      case 'blackAndWhite' : return LayerKind.BLACKANDWHITE;
      case 'selectiveColor' : return LayerKind.SELECTIVECOLOR;
      case 'vibrance' : return LayerKind.VIBRANCE;
      case 'brightnessEvent' : return LayerKind.BRIGHTNESSCONTRAST;
      case  'channelMixer' : return LayerKind.CHANNELMIXER;
      case 'curves' : return LayerKind.CURVES;
      case 'exposure' : return LayerKind.EXPOSURE;
      // if not one of the above adjustments return - adjustment layer type
      default : return typeIDToStringID(desc.getList (stringIDToTypeID('adjustment')).getClass (0));
    }
    }
};

// Returns an object like: { font, size, color }
function getFontInfoByIndex(layerIndex){
    var layerReference = new ActionReference();
    layerReference.putIndex(charIDToTypeID( "Lyr " ), layerIndex);
    var layerDescription = executeActionGet(layerReference).getObjectValue(stringIDToTypeID('textKey'));

    var textStyle = layerDescription.getList(stringIDToTypeID('textStyleRange')).getObjectValue(0).getObjectValue(stringIDToTypeID('textStyle'));
    var font = textStyle.getString(charIDToTypeID("FntN"));

    var size = textStyle.getDouble(stringIDToTypeID('size'));
    if (layerDescription.hasKey(stringIDToTypeID('transform'))) {
        var mFactor = layerDescription.getObjectValue(stringIDToTypeID('transform')).getUnitDoubleValue(stringIDToTypeID("yy"));
        size = (size * mFactor);
    }
    size = size.toFixed(2);

    var color = textStyle.getObjectValue(charIDToTypeID('Clr '));
    var textColor = new SolidColor;
    textColor.rgb.red = color.getDouble(charIDToTypeID('Rd  '));
    textColor.rgb.green = color.getDouble(charIDToTypeID('Grn '));
    textColor.rgb.blue = color.getDouble(charIDToTypeID('Bl  '));
    return { font: font, size: size, color: textColor.rgb.hexValue };
}

function getLayerVisibleByIndex(layerIndex) {
    var layerReference = new ActionReference();
    layerReference.putIndex(charIDToTypeID('Lyr '), layerIndex);
    var layerDescription = executeActionGet(layerReference);
    return layerDescription.getUnitDoubleValue(charIDToTypeID('Vsbl'));
}

function getLayerOpacityByIndex(layerIndex) {
    var layerReference = new ActionReference();
    layerReference.putIndex(charIDToTypeID('Lyr '), layerIndex);
    var layerDescription = executeActionGet(layerReference);
    return layerDescription.getUnitDoubleValue(charIDToTypeID('Opct'));
}

function getAllLayersByIndex() {
    function getNumberLayers() {
        var ref = new ActionReference();
        ref.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("NmbL"))
        ref.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        return executeActionGet(ref).getInteger(charIDToTypeID("NmbL"));
    }

    function hasBackground() {
        var ref = new ActionReference();
        ref.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("Bckg"));
        ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Back")) //bottom Layer/background
        var desc = executeActionGet(ref);
        var res = desc.getBoolean(charIDToTypeID("Bckg"));
        return res
    };

    function getLayerType(idx, prop) {
        var ref = new ActionReference();
        ref.putIndex(charIDToTypeID("Lyr "), idx);
        var desc = executeActionGet(ref);
        var type = desc.getEnumerationValue(prop);
        var res = typeIDToStringID(type);
        return res
    };

    var cnt = getNumberLayers() + 1;
    var res = new Array();
    if (hasBackground()) {
        var i = 0;
    } else {
        var i = 1;
    };
    var prop = stringIDToTypeID("layerSection")
    for (i; i < cnt; i++) {
        var temp = getLayerType(i, prop);
        if (temp != "layerSectionEnds") res.push(i);
    };
    return res;
};

function makeActiveByIndex(idx, visible) {
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putIndex(charIDToTypeID("Lyr "), idx)
    desc.putReference(charIDToTypeID("null"), ref);
    desc.putBoolean(charIDToTypeID("MkVs"), visible);
    executeAction(charIDToTypeID("slct"), desc, DialogModes.NO);
};

// Returns layer bounds with pixel units
function getLayerBoundsByIndex(layerIndex) {
    var ref = new ActionReference();
    ref.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("bounds"));
    ref.putIndex(charIDToTypeID("Lyr "), layerIndex);
    var desc = executeActionGet(ref).getObjectValue(stringIDToTypeID("bounds"));
    return [desc.getUnitDoubleValue(stringIDToTypeID('left')),
            desc.getUnitDoubleValue(stringIDToTypeID('top')),
            desc.getUnitDoubleValue(stringIDToTypeID('right')),
            desc.getUnitDoubleValue(stringIDToTypeID('bottom'))];
}

// -----------------------------------------------------------------------------
// Standard Library Helpers
// -----------------------------------------------------------------------------

function init() {
    // PS only seems to load standard objects once needed
    // We need to add these methods after an array has been created
    var array = new Array();

    Array.prototype.unique = function() {
        var unique = [];
        for (var i = 0; i < this.length; i += 1) {
            if (unique.indexOf(this[i]) == -1) {
                unique.push(this[i])
            }
        }
        return unique;
    };

    Array.prototype.indexOf = function(searchElement) {
        "use strict";
        if (this == null) {
            throw new TypeError();
        }
        var t = Object(this);
        var len = t.length >>> 0;
        if (len === 0) {
            return -1;
        }
        var n = 0;
        if (arguments.length > 1) {
            n = Number(arguments[1]);
            if (n != n) { // shortcut for verifying if it's NaN
                n = 0;
            } else if (n != 0 && n != Infinity && n != -Infinity) {
                n = (n > 0 || -1) * Math.floor(Math.abs(n));
            }
        }
        if (n >= len) {
            return -1;
        }
        var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
        for (; k < len; k++) {
            if (k in t && t[k] === searchElement) {
                return k;
            }
        }
        return -1;
    }

    Stdlib = function Stdlib() {};

    Stdlib.findFiles = function (folder, mask) { //from Xbytor's Xtools
        var files = Stdlib.getFiles(folder, mask);
        var folders = Stdlib.getFolders(folder);

        for (var i = 0; i < folders.length; i++) {
            var f = folders[i];
            var ffs = Stdlib.findFiles(f, mask);
            while (ffs.length > 0) {
                files.push(ffs.shift());
            }
        }
        return files;
    };

    Stdlib.getFiles = function (folder, mask) {
        var files = [];
        var getF;
        if (Folder.prototype._getFiles) {
            getF = function (f, m) {
                return f._getFiles(m);
            }
        } else {
            getF = function (f, m) {
                return f.getFiles(m);
            }
        }

        if (mask instanceof RegExp) {
            var allFiles = getF(folder);
            for (var i = 0; i < allFiles.length; i = i + 1) {
                var f = allFiles[i];
                if (decodeURI(f.absoluteURI).match(mask)) {
                    files.push(f);
                }
            }
        } else if (typeof mask == "function") {
            var allFiles = getF(folder);
            for (var i = 0; i < allFiles.length; i = i + 1) {
                var f = allFiles[i];
                if (mask(f)) {
                    files.push(f);
                }
            }
        } else {
            files = getF(folder, mask);
        }

        return files;
    };

    Stdlib.getFolders = function (folder) {
        return Stdlib.getFiles(folder, function (file) {
            return file instanceof Folder;
        });
    }

    Folder.prototype.findFiles = function (mask) {
        return Stdlib.findFiles(this, mask);
    };
}
