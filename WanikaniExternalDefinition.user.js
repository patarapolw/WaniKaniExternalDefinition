// ==UserScript==
// @name         WaniKani External Definition
// @namespace    http://www.wanikani.com
// @version      0.10
// @description  Get External Definition from Weblio, Kanjipedia
// @author       NicoleRauch (original script by polv)
// @match        *://www.wanikani.com/review/session*
// @match        *://www.wanikani.com/lesson/session*
// @match      *://www.wanikani.com/*vocabulary/*
// @match      *://www.wanikani.com/*kanji/*
// @match      *://www.wanikani.com/*radical/*
// @grant        GM_xmlhttpRequest
// @connect      kanjipedia.jp
// @connect      weblio.jp
// ==/UserScript==

(function () {
    'use strict';

    var link_color = "color: #666666;";
    var entryClazz = "wkexternaldefinition";

    // redefine the crosslink CSS class from weblio:
    var style = document.createElement('style');
    style.innerHTML = '.crosslink { ' + link_color + ' text-decoration: none;}';
    document.getElementsByTagName('head')[0].appendChild(style);
    ///////////////////////////////////////////////////////////////////////////////////////////////////


    ///////////////////////////////////////////////////////////////////////////////////////////////////
    // Updating the kanji and vocab we are looking for
    var kanji;
    var vocab;

    var url = document.URL;

    $.jStorage.listenKeyChange('currentItem', function () {
        var current = $.jStorage.get('currentItem');
        kanji = current.kan;
        vocab = current.voc ? current.voc.replace(/する|〜/, '') : undefined;
    });

    $.jStorage.listenKeyChange('l/currentLesson', function () {
        var current = $.jStorage.get('l/currentLesson');
        kanji = current.kan;
        vocab = current.voc ? current.voc.replace(/する|〜/, '') : undefined;
    });

    var urlParts = url.split("/");
    if (urlParts[urlParts.length - 2] === "kanji") {
        kanji = urlParts[urlParts.length - 1];
        updateInfo();
    }
    if (urlParts[urlParts.length - 2] === "vocabulary") {
        vocab = urlParts[urlParts.length - 1].replace(/する|〜/, '');
        updateInfo();
    }


    ///////////////////////////////////////////////////////////////////////////////////////////////////
    // Loading the information and updating the webpage
    function updateInfo() {
        var hrefColor = ' style="' + link_color + '"';

        function insertDefinition(html, full_url, name, lessonInsertAfter) {
            var h2_style = url.indexOf('lesson') !== -1 ? ' style="margin-top: 1.25em;" ' : "";
            var newHtml = '<section class="' + entryClazz + '">'
                + '<h2' + h2_style + '>' + name + ' Explanation</h2>'
                + html + '<a href="' + full_url + '"' + hrefColor + ' target="_blank">Click for full entry</a>'
                + '</section>';

            if (url.indexOf('kanji') !== -1 || url.indexOf('vocabulary') !== -1 || url.indexOf('review') !== -1) {
                $('#note-meaning:visible').before(newHtml);
            }
            if (url.indexOf('lesson') !== -1) {
                $(lessonInsertAfter + ":visible").after(newHtml);
            }
        }

        function insertReading(kanjiInfo) {
            if (url.indexOf('kanji') !== -1) {
                $(".span4").removeClass("span4").addClass("span3").last().after('<div class="span3 '+entryClazz+'"><h3>Kanjipedia</h3>' + kanjiInfo + '</div>');
            }
            if (url.indexOf('review') !== -1) {
                $('#item-info #item-info-col1 #item-info-reading:visible').after('<section class="'+entryClazz+'"><h2>Kanjipedia</h2>' + kanjiInfo + "</section>");
            }
            if (url.indexOf('lesson') !== -1) {
                $('#supplement-kan-reading:visible .pure-u-1-4 > div').first().after('<span class="'+entryClazz+'"><h2 style="margin-top: 1.25em;">Kanjipedia</h2>' + kanjiInfo + "</span>");
            }
        }

        if (kanji) {
            var kanjipediaUrlBase = 'https://www.kanjipedia.jp/';
            var regexImgSrc = /img src="/g;
            var replacementImgSrc = 'img width="16px" src="' + kanjipediaUrlBase;
            var regexTxtNormal = /class="txtNormal">/g;
            var replacementTxtNormal = '>.';
            var regexSpaceBeforeCircledNumber = / ([\u2460-\u2473])/g;
            GM_xmlhttpRequest({
                method: "GET",
                url: kanjipediaUrlBase + 'search?k=' + kanji + '&kt=1&sk=leftHand',
                onload: function (data) {
                    var rawKanjiURL = $('<div />').append(data.responseText.replace(regexImgSrc, replacementImgSrc)).find('#resultKanjiList a')[0].href;
                    var kanjiPageURL = kanjipediaUrlBase + rawKanjiURL.slice(25);
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: kanjiPageURL,
                        onload: function (data) {
                            var rawResponseNode = $('<div />').append(data.responseText
                                .replace(regexImgSrc, replacementImgSrc)
                                .replace(regexTxtNormal, replacementTxtNormal)
                                .replace(regexSpaceBeforeCircledNumber, "<br/>$1")
                            );

                            // First, remove any already existing entries to avoid displaying entries for other items:
                            $('.' + entryClazz).remove();

                            insertReading(rawResponseNode.find('#kanjiLeftSection #onkunList').html());

                            var kanjiDefinition = rawResponseNode.find('#kanjiRightSection p').html() || "Definition not found.";
                            insertDefinition("<div style='margin-bottom: 0.5em;'>" + kanjiDefinition + "</div>",
                                kanjiPageURL, 'Kanjipedia', '#supplement-kan-meaning-mne');
                        }
                    });
                }
            });
        }
        if (vocab) {
            var vocabPageURL = 'https://www.weblio.jp/content/' + vocab;
            GM_xmlhttpRequest({
                method: "GET",
                url: vocabPageURL,
                onload: function (data) {
                    var vocabDefinition = $('<div />').append(data.responseText).find('.kiji > div').filter(
                        function() {
                            return $('script', this).length === 0
                        }).html() || "Definition not found.";

                    // First, remove any already existing entries to avoid displaying entries for other items:
                    $('.' + entryClazz).remove();

                    insertDefinition("<div style='margin-bottom: 10px'>" + vocabDefinition + "</div>",
                        vocabPageURL, 'Weblio', '#supplement-voc-meaning-exp');
                }
            });
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////
    // Triggering updates on lessons and reviews

    function triggerOnLesson(targetId) {
        var targetNode = $('#' + targetId).get(0);
        if(targetNode) { // mutation observer throws an error if the node is undefined
            new MutationObserver(function (mutations) {
                var currentNode = mutations[0].target;
                if (currentNode && currentNode.id === targetId
                    && currentNode.style && currentNode.style.display !== "none") {
                    updateInfo();
                }
            }).observe(targetNode, {attributes: true});
        }
    }

    function triggerOnReview(targetId, nodeId) {
        var targetNode = $('#' + targetId).get(0);
        if(targetNode) { // mutation observer throws an error if the node is undefined
            new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; ++i) {
                    for (var j = 0; j < mutations[i].addedNodes.length; ++j) {
                        var addedNode = mutations[i].addedNodes[j];
                        if (addedNode.id === nodeId && addedNode.style.display !== "none") {
                            updateInfo();
                            return; // we found a node we want to update -> stop iterating
                        }
                    }
                }
            }).observe(targetNode, {childList: true, attributes: true});
        }
    }

    // on review meaning page (vocab and kanji):
    triggerOnReview('item-info-col2', "note-meaning");

    // on review reading page (vocab and kanji, but we change the page only when kanji)
    triggerOnReview('item-info-col1', "item-info-reading");

    // on lesson vocab meaning page:
    triggerOnLesson("supplement-voc-meaning");

    // on lesson kanji meaning page:
    triggerOnLesson("supplement-kan-meaning");

    // on lesson kanji reading page:
    triggerOnLesson("supplement-kan-reading");

})();
