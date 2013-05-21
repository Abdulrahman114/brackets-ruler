/*
 * The MIT License (MIT)
 * Copyright (c) 2013 Lance Campbell. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*jslint vars: true, plusplus: true, devel: true, regexp: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, Mustache, window */

define(function (require, exports, module) {
    "use strict";
    
    // --- Required modules ---
    var PreferencesManager  = brackets.getModule("preferences/PreferencesManager"),
        Menus               = brackets.getModule("command/Menus"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        Editor              = brackets.getModule("editor/Editor").Editor,
        CommandManager      = brackets.getModule("command/CommandManager"),
        AppInit             = brackets.getModule("utils/AppInit"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        ViewCommandHandlers = brackets.getModule("view/ViewCommandHandlers"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils");
    
    // --- Constants ---
    var RULER_COMMAND_NAME  = "Toggle Ruler",
        RULER_COMMAND_ID    = "lkcampbell.toggle-ruler",
        RULER_SHORTCUT_KEY  = "Ctrl-Alt-R";
    
    var GUIDE_COMMAND_NAME  = "Toggle Column Guide",
        GUIDE_COMMAND_ID    = "lkcampbell.toggle-column-guide",
        GUIDE_SHORTCUT_KEY  = "Ctrl-Alt-G";
    
    var MINIMUM_COLUMNS = 80,   // Must be multiple of ten
        MAX_NUMBER_SIZE = 12;   // Measured in pixel units
    
    // --- Private variables ---
    var _defPrefs       = { rulerEnabled:   false,
                            guideEnabled:   false,
                            guideColumn:    MINIMUM_COLUMNS },
        _prefs          = PreferencesManager.getPreferenceStorage(module, _defPrefs),
        _viewMenu       = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU),
        _rulerHTML      = require("text!ruler-template.html"),
        _currentDoc     = null,
        _currentEditor  = null,
        _guideColumn    = MINIMUM_COLUMNS;
    
    var _$rulerPanel     = null;
    
    var _templateFunctions = {
        "rulerNumber": function () {
            var i           = 0,
                finalHTML   = '';
            
            for (i = 10; i <= MINIMUM_COLUMNS; i += 10) {
                finalHTML += '                ';
                finalHTML += '<td class="number" colspan="';
                finalHTML += (i === MINIMUM_COLUMNS) ? '6' : '9';
                finalHTML += '">';
                finalHTML += i;
                finalHTML += '</td>';
                
                if (i !== MINIMUM_COLUMNS) {
                    finalHTML += '\n';
                    finalHTML += '                ';
                    finalHTML += '<td class="number"></td>';
                    finalHTML += '\n';
                }
            }
            return finalHTML;
        },
        "rulerTickMark": function () {
            var i           = 0,
                finalHTML   = '';
            
            for (i = 0; i <= MINIMUM_COLUMNS; i++) {
                finalHTML += '                ';
                
                if (i % 5) {
                    // Minor tick mark
                    finalHTML += '<td class="minor-tick-mark" id="tick-';
                    finalHTML += i;
                    finalHTML += '">&nbsp;</td>';
                } else {
                    // Major tick mark
                    finalHTML += '<td class="major-tick-mark" id="tick-';
                    finalHTML += i;
                    finalHTML += '">&nbsp;</td>';
                }
                
                if (i !== MINIMUM_COLUMNS) {
                    finalHTML += '\n';
                }
            }
            return finalHTML;
        }
    };
      
    // --- Private functions ---
    function _updateGuideHeight(event) {
        console.log(event);
    }
    
    function _updateGuideColumn(event) {
        console.log(event);
    }
    
    function _updateRulerScroll() {
        var editor              = EditorManager.getCurrentFullEditor(),
            cm                  = editor ? editor._codeMirror : null,
            $cmSizer            = null,
            sizerMarginWidth    = 0,
            linePaddingWidth    = 0,
            tickWidth           = 0,
            rulerOffset         = 0,
            $ruler              = $("#brackets-ruler #ruler");
        
        if (_$rulerPanel.is(":hidden")) { return; }
        
        if (cm) {
            // Scroll the ruler to the proper horizontal position
            $cmSizer            = $(cm.getScrollerElement()).find(".CodeMirror-sizer");
            sizerMarginWidth    = parseInt($cmSizer.css("margin-left"), 10);
            linePaddingWidth    = parseInt($(".CodeMirror pre").css("padding-left"), 10);
            tickWidth           = $("#brackets-ruler #tick-mark-left-filler").width();
            rulerOffset         = sizerMarginWidth + linePaddingWidth;
            rulerOffset         -= Math.ceil(tickWidth * 1.5);
            rulerOffset         -= cm.getScrollInfo().left;
            $ruler.css("left", rulerOffset + "px");
        } else {
            $ruler.css("left", "0px");
        }
    }
    
    function _updateTickMarks() {
        var fontSize        = $(".CodeMirror").css("font-size"),
            $tickMarks      = $("#brackets-ruler .tick-marks"),
            $rulerNumbers   = $("#brackets-ruler .numbers");
        
        if (_$rulerPanel.is(":hidden")) { return; }
        
        $tickMarks.css("font-size", fontSize);
        
        if (parseInt(fontSize, 10) < MAX_NUMBER_SIZE) {
            $rulerNumbers.css("font-size", fontSize);
        } else {
            $rulerNumbers.css("font-size", MAX_NUMBER_SIZE + "px");
        }
        
        _updateRulerScroll();
    }
    
    function _updateRulerLength() {
        var editor              = EditorManager.getCurrentFullEditor(),
            cm                  = editor ? editor._codeMirror : null,
            currentMaxColumns   = 0,
            maxLineLength       = 0,
            newMaxColumns       = 0,
            $currentElement     = null,
            $newElement         = null,
            i                   = 0;
        
        if (_$rulerPanel.is(":hidden")) { return; }
        
        if (cm) {
            $currentElement     = $("#number-right-filler").prev();
            currentMaxColumns   = parseInt($currentElement.text(), 10);
            
            // CodeMirror does not provide the maxLineLength of the document
            // if word wrap is enabled.  If word wrap is on, this workaround
            // code flips it off, grabs the maxLineLength, then flips it back
            // on again.
            if (Editor.getWordWrap()) {
                Editor.setWordWrap(false);
                maxLineLength = cm.display.maxLineLength;
                Editor.setWordWrap(true);
            } else {
                maxLineLength = cm.display.maxLineLength;
            }
            
            if (maxLineLength > MINIMUM_COLUMNS) {
                newMaxColumns = Math.ceil(maxLineLength / 10) * 10;
            } else {
                newMaxColumns = MINIMUM_COLUMNS;
            }
            
            if (newMaxColumns < currentMaxColumns) {
                // Remove Ruler Numbers
                $currentElement = $("#number-right-filler");
                $currentElement.prev().remove();
                
                for (i = (currentMaxColumns - 10); i > newMaxColumns; i -= 10) {
                    $currentElement.prev().remove();
                    $currentElement.prev().remove();
                }
                
                $currentElement.prev().remove();
                $currentElement.prev().attr("colspan", 6);
                
                // Remove Ruler Tick Marks
                $currentElement = $("#tick-mark-right-filler");
                
                for (i = currentMaxColumns; i > newMaxColumns; i--) {
                    $currentElement.prev().remove();
                }
            } else if (newMaxColumns > currentMaxColumns) {
                // Add Ruler Numbers
                $currentElement = $("#number-right-filler").prev();
                $currentElement.attr("colspan", 9);
                $newElement = $("<td></td>");
                $newElement.attr("class", "number");
                $currentElement.after($newElement);
                $currentElement = $currentElement.next();
                
                for (i = (currentMaxColumns + 10); i <= newMaxColumns; i += 10) {
                    $newElement = $("<td></td>");
                    $newElement.attr("class", "number");
                    
                    if (i !== newMaxColumns) {
                        $newElement.attr("colspan", 9);
                    } else {
                        $newElement.attr("colspan", 6);
                    }
                    
                    $newElement.text(i);
                    $currentElement.after($newElement);
                    $currentElement = $currentElement.next();
                    
                    if (i !== newMaxColumns) {
                        $newElement = $("<td></td>");
                        $newElement.attr("class", "number");
                        $currentElement = $currentElement.after($newElement);
                        $currentElement = $currentElement.next();
                    }
                }
                
                // Add Ruler Tick Marks
                $currentElement = $("#tick-mark-right-filler").prev();
                
                for (i = (currentMaxColumns + 1); i <= newMaxColumns; i++) {
                    $newElement = $("<td></td>");
                    
                    if (i % 5) {
                        // Minor Tick Mark
                        $newElement.attr("class", "minor-tick-mark");
                    } else {
                        // Major Tick Mark
                        $newElement.attr("class", "major-tick-mark");
                    }
                    
                    $newElement.attr("id", "tick-" + i);
                    
                    // Insert non-breaking space character
                    $newElement.text("\xa0");
                    
                    $currentElement.after($newElement);
                    $currentElement = $currentElement.next();
                }
            } // else they are equal so do nothing...
        }
    }
    
    function _showRuler() {
        _$rulerPanel.show();
        EditorManager.resizeEditor();
        
        // Full ruler updates must occur ONLY when the ruler is visible.
        // jQuery doesn't return width() for hidden elements.
        _updateTickMarks();
        _updateRulerScroll();
        _updateRulerLength();
    }
    
    function _hideRuler() {
        _$rulerPanel.hide();
        EditorManager.resizeEditor();
    }
    
    function _toggleRuler() {
        var rulerCommand    = CommandManager.get(RULER_COMMAND_ID),
            rulerEnabled    = !rulerCommand.getChecked();
        
        rulerCommand.setChecked(rulerEnabled);
        _prefs.setValue("rulerEnabled", rulerEnabled);
        
        if (rulerEnabled) {
            _showRuler();
        } else {
            _hideRuler();
        }
    }
    
    function _toggleColumnGuide() {
        var guideCommand    = CommandManager.get(GUIDE_COMMAND_ID),
            guideEnabled    = !guideCommand.getChecked();
        
        guideCommand.setChecked(guideEnabled);
        _prefs.setValue("rulerEnabled", guideEnabled);
        
        if (guideEnabled) {
            console.log("Calling _showGuide()");
//            _showGuide();
        } else {
            console.log("Calling _hideGuide()");
//            _hideGuide();
        }
    }
    
    function _handleDocumentChange() {
        var rulerCommand    = CommandManager.get(RULER_COMMAND_ID),
            rulerEnabled    = rulerCommand.getChecked();
        
        if (_currentDoc) {
            $(_currentDoc).off("change", _updateRulerLength);
            _currentDoc.releaseRef();
        }
        
        _currentDoc = DocumentManager.getCurrentDocument();
        
        if (_currentDoc) {
            $(_currentDoc).on("change", _updateRulerLength);
            _currentDoc.addRef();
        } else {
            _hideRuler();
            return;
        }
        
        if (_currentEditor) {
            $(_currentEditor).off("scroll", _updateRulerScroll);
        }
        
        _currentEditor = EditorManager.getCurrentFullEditor();
        
        if (_currentEditor) {
            $(_currentEditor).on("scroll", _updateRulerScroll);
            _currentEditor.refresh();
        }
        
        if (rulerEnabled) {
            _showRuler();
        } else {
            _hideRuler();
        }
    }

    // --- Initialize Extension ---
    AppInit.appReady(function () {
        var rulerEnabled    = _prefs.getValue("rulerEnabled"),
            guideEnabled    = _prefs.getValue("guideEnabled"),
            _guideColumn    = _prefs.getValue("guideColumn");
        
        // Register commands
        CommandManager.register(RULER_COMMAND_NAME, RULER_COMMAND_ID, _toggleRuler);
        CommandManager.register(GUIDE_COMMAND_NAME, GUIDE_COMMAND_ID, _toggleColumnGuide);
        
        // Add to View menu
        if (_viewMenu) {
            _viewMenu.addMenuItem(RULER_COMMAND_ID, RULER_SHORTCUT_KEY);
            _viewMenu.addMenuItem(GUIDE_COMMAND_ID, GUIDE_SHORTCUT_KEY);
        }
        
        // Apply user preferences
        CommandManager.get(RULER_COMMAND_ID).setChecked(rulerEnabled);
        CommandManager.get(GUIDE_COMMAND_ID).setChecked(guideEnabled);
        
        // Add Event Listeners
        $(ViewCommandHandlers).on("fontSizeChange", _updateTickMarks);
        $(DocumentManager).on("currentDocumentChange", _handleDocumentChange);
        $(window).resize(_updateGuideHeight);
        
        // Load the ruler CSS and create the ruler
        ExtensionUtils.loadStyleSheet(module, "ruler.css")
            .done(function () {
                _$rulerPanel = $(Mustache.render(_rulerHTML, _templateFunctions));
                _$rulerPanel.click(_updateGuideColumn);
                $("#editor-holder").before(_$rulerPanel);
                
                _currentDoc = DocumentManager.getCurrentDocument();
                
                if (_currentDoc) {
                    $(_currentDoc).on("change", _updateRulerLength);
                    _currentDoc.addRef();
                } else {
                    _hideRuler();
                    return;
                }
                
                _currentEditor = EditorManager.getCurrentFullEditor();
                
                if (_currentEditor) {
                    $(_currentEditor).on("scroll", _updateRulerScroll);
                }
                
                if (rulerEnabled) {
                    _showRuler();
                } else {
                    _hideRuler();
                }
            });
    });
});
