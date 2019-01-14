// ==UserScript==
// @name         WaniKani External Definition
// @namespace    http://www.wanikani.com
// @version      0.7
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


    ///////////////////////////////////////////////////////////////////////////////////////////////////
    // Updating the kanji and vocab we are looking for
    var kanji;
    var vocab;

    var w = $('div#character').text().trim().replace(/する|〜/, '');
    if (w.length === 1) {
        kanji = w;
    } else {
        vocab = w;
    }

    var url = document.URL;
    console.log("url", url);

    $.jStorage.listenKeyChange('currentItem', function () {
        console.log("currentItem", current)
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
    console.log(urlParts)
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
        function insertHTML(clazz, html, full_url, name) {
            if (url.indexOf('kanji') !== -1 || url.indexOf('vocabulary') !== -1 || url.indexOf('review') !== -1) {
                console.log("inserted on item or review page")
                $('<section class="' + clazz + '"></section>').insertBefore('#note-meaning');
            }

            $('.' + clazz).html(html + '<a href="' + full_url + '" target="_blank">Click for full entries</a>');
            $('.' + clazz).prepend('<h2>' + name + ' Explanation</h2>');
            $('.' + clazz).css('display', 'block');
        }

        if (kanji) {
            var url_base = 'https://www.kanjipedia.jp/';
            var regex = /img src="/g;
            var replacement = "img width=\"16px\" src=\"" + url_base;
            console.log('Opening ' + url_base + 'search?k=' + kanji + '&kt=1&sk=leftHand');
            GM_xmlhttpRequest({
                method: "GET",
                url: url_base + 'search?k=' + kanji + '&kt=1&sk=leftHand',
                onload: function (data) {
                    var result = $('<div />').append(data.responseText.replace(regex, replacement)).find('#resultKanjiList a')[0].href;
                    console.log('Opening ' + url_base + result.slice(25));
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: url_base + result.slice(25),
                        onload: function (data) {
                            var result2 = $('<div />').append(data.responseText.replace(regex, replacement)).find('#kanjiRightSection p').html();
                            if (result2 === undefined) result2 = "Definition not found.";

                            // $('#item-info-col2').prepend('<section class="kanjipedia"></section>');
                            if (url.indexOf('lesson') !== -1) {
                                $('#supplement-kan-meaning .col2').prepend('<section class="kanjipedia"></section>');
                                console.log('Prepended kanji');
                            } /* else {
                                if ($.jStorage.get('questionType') === 'reading') $('.kanjipedia').css('display', 'none');
                            } */

                            insertHTML('kanjipedia', "<div style='margin-bottom: 0;'>" + result2 + "</div>", url_base + result.slice(25), 'Kanjipedia');
                        }
                    });
                }
            });
        }
        if (vocab) {
            var url_vocab = 'https://www.weblio.jp/content/' + vocab;
            console.log('Opening ' + url_vocab);
            GM_xmlhttpRequest({
                method: "GET",
                url: url_vocab,
                onload: function (data) {
                    var result = $('<div />').append(data.responseText).find('.NetDicBody').html();
                    if (result === undefined) {
                        result = "Definition not found.";
                    }
                    if (vocab.length === 1) {
                        var i = -1;
                        $.each($('<div />').append(data.responseText).find('.NetDicHead .midashigo'), function (index, value) {
                            var str = value.textContent;
                            if (str.indexOf('漢字') !== -1) i = index;
                        });
                        console.log(i);

                        var full_result = $('<div />').append(data.responseText).find('.NetDicBody:nth-child(' + (3 * i + 2) + ')').html();
                        if (i !== -1) {
                            result = '';
                            for (var j = 0; result.length < 200 && nthIndex(full_result, vocab, j) < result.length;) {
                                j++;
                                result = full_result.substring(nthIndex(full_result, vocab, j) - 2, full_result.indexOf('【 ', nthIndex(full_result, vocab, j)));
                            }
                            console.log(result.length);
                        } else
                            result = 'Kanji definition not found.';
                    }

                    if (url.indexOf('lesson') !== -1) {
                        $('#supplement-voc-meaning .col2').prepend('<section class="weblio"></section>');
                    }

                    /*
                    $('#item-info-col2').prepend('<section class="weblio"></section>');

                    else {
                        if ($.jStorage.get('questionType') === 'reading') $('.weblio').css('display', 'none');
                    }
                    */


                    insertHTML('weblio', result, url_vocab, 'Weblio');
                }
            });
        }
    }


    // updating on review change, but only when on meaning page:
    var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; ++i) {
            for (var j = 0; j < mutations[i].addedNodes.length; ++j) {
                var addedNode = mutations[i].addedNodes[j];
                if (addedNode.id === "note-meaning" &&
                    (addedNode.attributes.style === undefined || addedNode.attributes.style.nodeValue.indexOf("none") === -1)) {
                    updateInfo();
                }
            }
        }
    });
    observer.observe($('#item-info-col2').get(0), {childList: true, attributes: true});

    // setup observer to change kanji info box contents for subsequent items
    var observer2 = new MutationObserver(function (mutations) {
        var w = $('div#character').text().trim().replace(/する|〜/, '');
        if (w.length === 1) {
            kanji = w;
        } else {
            vocab = w;
        }
        $('.weblio').remove();
        $('.kanjipedia').remove();
        updateInfo();
    });
    observer2.observe($('div#character').get(0), {attributes: true, childList: true, characterData: true});

    var observer3 = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; ++i) {
            for (var j = 0; j < mutations[i].addedNodes.length; ++j) {
                if (mutations[i].addedNodes[j].style.display === "block") {
                    $('.weblio').css('display', 'block');
                    $('.kanjipedia').css('display', 'block');
                }
            }
        }
    });
    observer3.observe($('#item-info-meaning-mnemonic').get(0), {attributes: true});

    function nthIndex(str, pat, n) {
        var L = str.length, i = -1;
        while (n-- && i++ < L) {
            i = str.indexOf(pat, i);
            if (i < 0) break;
        }
        return i;
    }
})();


try {
    $('.app-store-menu-item').remove();
    $('<li class="app-store-menu-item"><a href="https://community.wanikani.com/t/there-are-so-many-user-scripts-now-that-discovering-them-is-hard/20709">App Store</a></li>').insertBefore($('.navbar .dropdown-menu .nav-header:contains("Account")'));
    window.appStoreRegistry = window.appStoreRegistry || {};
    window.appStoreRegistry[GM_info.script.uuid] = GM_info;
    localStorage.appStoreRegistry = JSON.stringify(appStoreRegistry);
} catch (e) {
}
