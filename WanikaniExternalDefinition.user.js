// ==UserScript==
// @name         WaniKani External Definition
// @namespace    http://www.wanikani.com
// @version      0.6
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

(function() {
    'use strict';

    var word = $('div#character').text().trim().replace(/する|〜/,'');
    var url = document.URL;

    $.jStorage.listenKeyChange('currentItem', function(key) {
        word = $('div#character').text().trim().replace(/する|〜/,'');
    });

    function updateInfo(){
        if(word.length === 1) {
            var url_base = 'https://www.kanjipedia.jp/';
            var regex = /img src="/g;
            var replacement = "img width=\"16px\" src=\"" + url_base;
            console.log('Opening ' + url_base + 'search?k=' + word + '&kt=1&sk=leftHand');
            GM_xmlhttpRequest({
                method: "GET",
                url: url_base + 'search?k=' + word + '&kt=1&sk=leftHand',
                onload: function(data) {
                    var result = $('<div />').append(data.responseText.replace(regex, replacement)).find('#resultKanjiList a')[0].href;
                    console.log('Opening ' + url_base + result.slice(25));
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: url_base + result.slice(25),
                        onload: function(data) {
                            var result2 = $('<div />').append(data.responseText.replace(regex, replacement)).find('#kanjiRightSection p').html();
                            if(result === undefined) result = "Definition not found.";

                            if (url.indexOf('vocabulary') !== -1 || url.indexOf('kanji') !== -1 || url.indexOf('radical') !== -1)
                                $('<section class="kanjipedia"></section>').insertAfter('#information');
                            $('#item-info-col2').prepend('<section class="kanjipedia"></section>');
                            if(url.indexOf('lesson') !== -1) {
                                $('#supplement-kan-meaning .col2').prepend('<section class="kanjipedia"></section>');
                                $('#supplement-voc-meaning .col2').prepend('<section class="kanjipedia"></section>');
                                console.log('Prepended');
                            } else {
                                if ($.jStorage.get('questionType') === 'reading') $('.kanjipedia').css('display','none');
                            }

                            $('.kanjipedia').html(result2 + '<br><a href="'+ url_base + result.slice(25) +'" target="_blank">Click for full entries</a>');
                            $('.kanjipedia').prepend('<h2>Kanjipedia Explanation</h2>');
                        }
                    });
                }
            });
        } else {
            console.log('Opening ' + 'https://www.weblio.jp/content/' + word);
            GM_xmlhttpRequest({
                method: "GET",
                url: 'https://www.weblio.jp/content/' + word,
                onload: function(data) {
                    var result =  $('<div />').append(data.responseText).find('.NetDicBody').html();
                    if(result === undefined){
                        result = "Definition not found.";
                    }
                    if(word.length === 1) {
                        var i = -1;
                        $.each($('<div />').append(data.responseText).find('.NetDicHead .midashigo'), function(index, value){
                            var str = value.textContent;
                            if( str.indexOf('漢字') !== -1 ) i = index;
                        });
                        console.log(i);

                        var full_result = $('<div />').append(data.responseText).find('.NetDicBody:nth-child('+ (3*i+2) +')').html();
                        if (i !== -1){
                            result = '';
                            for(var j=0; result.length < 200 && nthIndex(full_result, word, j) < result.length; ) {
                                j++;
                                result = full_result.substring( nthIndex(full_result, word, j)-2, full_result.indexOf('【 ', nthIndex(full_result, word, j) ) );
                            }
                            console.log(result.length);
                        } else
                            result = 'Kanji definition not found.';
                    }

                    if (url.indexOf('vocabulary') !== -1 || url.indexOf('kanji') !== -1 || url.indexOf('radical') !== -1)
                        $('<section class="weblio"></section>').insertAfter('#information');
                    $('#item-info-col2').prepend('<section class="weblio"></section>');

                    if(url.indexOf('lesson') !== -1){
                        $('#supplement-kan-meaning .col2').prepend('<section class="weblio"></section>');
                        $('#supplement-voc-meaning .col2').prepend('<section class="weblio"></section>');
                        console.log('Prepended');
                    } else {
                        if ($.jStorage.get('questionType') === 'reading') $('.weblio').css('display','none');
                    }

                    $('.weblio').html(result + '<br><a href="https://www.weblio.jp/content/' + word +'" target="_blank">Click for full entries</a>');
                    $('.weblio').prepend('<h2>Weblio Explanation</h2>');
                }
            });
        }
    }

    if (url.indexOf('vocabulary') !== -1 || url.indexOf('kanji') !== -1 || url.indexOf('radical') !== -1) {
        word = $('span.japanese-font-styling-correction:first').text().trim().replace(/する|〜/,'');
        updateInfo();
    }

    var observer = new MutationObserver(function(mutations) {
        for(var i=0; i<mutations.length; ++i) {
            for(var j=0; j<mutations[i].addedNodes.length; ++j) {
                if(mutations[i].addedNodes[j].id === "item-info-meaning-mnemonic") {
                    updateInfo();
                }
            }
        }
    });
    observer.observe($('#item-info-col2').get(0), { childList: true });

    // setup observer to change kanji info box contents for subsequent items
    var observer2 = new MutationObserver(function(mutations) {
        word = $('div#character').text().trim().replace(/する|〜/,'');
        $('.weblio').remove();
        $('.kanjipedia').remove();
        updateInfo();
    });
    observer2.observe($('div#character').get(0), { attributes: true, childList: true, characterData: true });

    var observer3 = new MutationObserver(function(mutations) {
        for(var i=0; i<mutations.length; ++i) {
            for(var j=0; j<mutations[i].addedNodes.length; ++j) {
                if(mutations[i].addedNodes[j].style.display === "block") {
                    $('.weblio').css('display','block');
                    $('.kanjipedia').css('display','block');
                }
            }
        }
    });
    observer3.observe($('#item-info-meaning-mnemonic').get(0), { attributes: true });

})();

function nthIndex(str, pat, n){
    var L= str.length, i= -1;
    while(n-- && i++<L){
        i= str.indexOf(pat, i);
        if (i < 0) break;
    }
    return i;
}

try { $('.app-store-menu-item').remove(); $('<li class="app-store-menu-item"><a href="https://community.wanikani.com/t/there-are-so-many-user-scripts-now-that-discovering-them-is-hard/20709">App Store</a></li>').insertBefore($('.navbar .dropdown-menu .nav-header:contains("Account")')); window.appStoreRegistry = window.appStoreRegistry || {}; window.appStoreRegistry[GM_info.script.uuid] = GM_info; localStorage.appStoreRegistry = JSON.stringify(appStoreRegistry); } catch (e) {}
