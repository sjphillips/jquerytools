/**
 * @license 
 * form.validator @VERSION - HTML5 is here. Now use it.
 * 
 * Copyright (c) 2010 Tero Piirainen
 * http://flowplayer.org/tools/form/validator/
 *
 * Dual licensed under MIT and GPL 2+ licenses
 * http://www.opensource.org/licenses
 * 
 * Since: jQuery Tools 1.2.0 (Mar 2010)
 * Date: @DATE 
 */
 
/* --- TODO ---
	proper test page
	existing input replacement 
	
	Web Forms 2.0 compatibility
		http://www.whatwg.org/specs/web-forms/current-work/#form-validation			
		- checkValidity() DOM method for form
		- oninvalid attribute && $.fn.invalid() callback for input, textarea, and select
		- :invalid pseudo class 
		- willValidate attribute (true, false)
		- advanced: validity attribute
			http://www.whatwg.org/specs/web-forms/current-work/#telling-the-user 
*/
(function($) {	

	$.tools.form = $.tools.form || {};	
	
	// globals
	var customRe = /(\w+)\(?([^)]*)\)?/, 
		typeRe = /\[type=([a-z]+)\]/, 
		numRe = /^\d*$/
		
		// http://net.tutsplus.com/tutorials/other/8-regular-expressions-you-should-know/
		emailRe = /^([a-z0-9_\.-]+)@([\da-z\.-]+)\.([a-z\.]{2,6})$/i,
		urlRe = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i,
		 
		v = $.tools.form.validator = {
		
		version: '@VERSION', 
		
		conf: { 
			singleField: false, 		// all inputs at once
			singleError: false, 		// all errors per input at once			
			errorClass: 'error',
			messageClass: 'error',
			messagePosition: 'after',			
			lang: 'en',
			effect: 'default',		
			
			events: {
				input: null,		// change || blur || keyup
				error: 'keyup',	// change || blur || keyup
				form:  'submit' 	// click || keypress || mouseover	
			}
			
		},
		
		setMessage: function(matcher, msg, lang) {			
			var key = matcher.key || matcher,
				 m = this.messages[key] || {};
				 
			m[lang || 'en'] = msg;			
			this.messages[key] = m;   
		},

		messages: {
			"*": {en: "Invalid value"}		
		},
		
		fn: function(matcher, msg, fn, isCustom) {
			
			if ($.isFunction(msg)) { fn = msg; }
			else v.setMessage(matcher, msg);		 
			
			if (isCustom) {				
				fnx[matcher] = fn;
				
			} else {
				
				// check for "[type=xxx]" (not supported by jQuery 1.3 and below)
				var test = typeRe(matcher);
				if (test) { matcher = isType(test[1]); }				
				fns.push([matcher, fn]);		
			}
			
		},

		addEffect: function(name, showFn, closeFn) {
			effects[name] = [showFn, closeFn];
		}
		
		
	}, fns = [], fnx = {}, effects = {
		
		'default' : [
			
			// show errors function
			function(errs, done) {
				
				var conf = this.getConf();
				
				// loop errors
				$.each(errs, function(i, err) {
						
					// add error class	
					var input = err.input;					
					input.addClass(conf.errorClass);
					
					// get handle to existing error container
					var msg = input.next("." + conf.messageClass); 
					
					// create it if not present
					if (!msg.length) {
						msg = $("<div/>").addClass(conf.messageClass).fadeIn();
						
						if (conf.messagePosition == 'after') {
							input.after(msg);		
						} else {
							input.before(msg);	
						}						
					}
					
					// populate errors into the container
					msg.empty();					
					$.each(err.messages, function() {
						msg.append("<p>" + this + "</p>");			
					});
					
				});
				
			// hide errors function
			}, function(inputs, done) {
				var conf = this.getConf();				
				inputs.removeClass(conf.errorClass);
				inputs.siblings("." + conf.messageClass).remove();
			}
		]  
	};	
	
	
	function isType(type) { 
		function fn() {
			return this.getAttribute("type") == type;  	
		} 
		fn.key = "[type=" + type + "]";
		return fn;
	}
	
	
	// build-in standard functions
	v.fn(isType("email"), "Invalid email address", function(el, v) {
		return !v || emailRe.test(v);
	});
	
	v.fn(isType("url"), "Invalid URL", function(el, v) {
		return !v || urlRe.test(v);
	});
	
	v.fn(isType("number"), "Numeric value required", function(el, v) {
		return numRe.test(v);			
	});
	
	v.fn("[max]", "Maximum value is $1", function(el, v) {
		var max = el.attr("max");
		return parseFloat(v) <= parseFloat(max) ? true : max;
	});
	
	v.fn("[min]", "Minimum value is $1", function(el, v) {
		var min = el.attr("min");
		return parseFloat(v) >= parseFloat(min) ? true : min;
	});
	
	v.fn("[required]", "Value is required", function(el, v) {
		return !!v; 			
	});
	
	v.fn("[pattern]", function(el) {
		var p = new RegExp(el.attr("pattern"));  
		return p.test(el.val()); 			
	});

	
	/****   custom functions in "data-validate" attribute   ****/
	
	// @returns [fx, fx2, ...]
	v.fn("[data-validate]", function(el) {		
		var calls = el.attr("data-validate").split(/;\s*/), fails = [];

		$.each(calls, function(i, call) {
			var els = customRe.exec(call), fxname = els[1], fn = fnx[fxname];			
			if (!fn) { throw "Nonexistent custom validator: " + fxname; }
			var args = els[2] ? els[2].indexOf(",") != -1 ? els[2].split(",") : els[2] : null;

			var ret = fn.call(el.validator(), el, args); 
			if (ret !== true) {
				fails.push({match: fxname, substitutions: ret});
			}
		});
		
		return fails.length ? fails : true;
	});

	
	v.fn("equalto", "Value must equal to $1 field", function(el, name) {
		var f = this.getInputs().filter("[name=" + name + "]");
		return f.val() === el.val() ? true : f.attr("title") || name;
		
	}, true);
	
	v.fn("requires", "Required fields: $1", function(el, args) {
		var inputs = this.getInputs(), ret = [];
		
		$.each(args, function() {
			if (!inputs.filter("[name=" + this + "]").val()) { ret.push(this); };		
		});
		return ret.length ? ret.join(", ") : true;
		
	}, true);	

	
	function Validator(inputs, conf) {		
		
		// strip out buttons
		inputs = inputs.filter(":input").not(":button, :submit");
		if (!inputs.length) { throw "Validator: no input fields on your selector"; }		

		
		// utility function
		function pushMessage(to, matcher, subs) {
			
			var key = matcher.key || matcher,
				 msg = v.messages[key] || v.messages["*"];
			
			if (!conf.singleError || !to.length) {
				
				// localization
				msg = msg[conf.lang];
								
				// substitution
				if (typeof subs == 'string') { subs = [subs]; }
				var matches = msg.match(/\$\d/g);
				
				if (matches) {
					$.each(matches, function(i) {
						msg = msg.replace(this, subs[i]);
					});
				} 
				to.push(msg);
			}
		}
		
		
		// private variables
		var self = this, $self = $(this);
		
		inputs.data("validator", self);
		
		// API methods  
		$.extend(self, {

			getConf: function() {
				return conf;	
			},
			
			getInputs: function() {
				return inputs;	
			},			
			
			/* @returns boolean */
			checkValidity: function(els, e) {
				
				els = els || inputs;
				e = e || $.Event();

				// onBeforeValidate
				e.type = "onBeforeValidate";
				$self.trigger(e, [els]);				
				if (e.isDefaultPrevented()) { return e.result; }
				
					
				var errs = [], event = conf.events.error + ".v";
				
				// loop trough the inputs
				els.each(function() {
					var el = $(this).unbind(event).data("messages", []);					
					
					// loop all validator functions
					$.each(fns, function() {
						var fn = this, match = fn[0];

						// match found
						if (el.filter(match).length)  {  
							
							// execute a validator function
							var ret = fn[1].call(self, el, el.val());
							
							// validation failed. multiple substitutions can be returned with an array
							if (ret !== true) {								
								
								// onBeforeFail
								e.type = "onBeforeFail";
								$self.trigger(e, [el, match]);
								if (e.isDefaultPrevented()) { return false; }
								
								// error message container for a field
								var msgs = el.data("messages");
								
								// custom validator return value
								if ($.isArray(ret) && typeof ret[0] == 'object') { 
									$.each(ret, function() {
										pushMessage(msgs, this.match, this.substitutions);		
									});  
									
								// normal return value: array, string or nothing (substitutions)
								} else {
									pushMessage(msgs, match, ret);	
								}
								
								errs.push({input: el, messages: msgs});  
								
								// begin validating upon error event type (such as keyup) 
								if (conf.events.error) {
									el.bind(event, function() {
										self.checkValidity(el);		
									});							
								}
							}							
						}
					});
					
					if (conf.singleField && errs.length) { return false; }
					
				});
				
				// validation done. now check that we have a proper effect at hand
				var eff = effects[conf.effect];
				if (!eff) { throw "Validator: cannot find effect \"" + conf.effect + "\""; }
				
				// errors found
				if (errs.length) {					
					
					// onFail callback
					e.type = "onFail";					
					$self.trigger(e, [errs]); 
					
					// call the effect
					if (!e.isDefaultPrevented()) {						
						eff[0].call(self, errs);													
					}  
					
					return false;
					
				// no errors
				} else {		
					
					// call the effect
					eff[1].call(self, els);
					
					// onSuccess callback
					e.type = "onSuccess";					
					$self.trigger(e);
					
					els.unbind(event);
				}
				
				return true;				
			},
			
			bind: function(name, fn) {
				$self.bind(name, fn);
				return self;	
			},	
			
			unbind: function(name) {
				$self.unbind(name);
				return self;	
			}
			
		});
		
		// callbacks	
		$.each("onBeforeValidate,onBeforeFail,onFail,onSuccess".split(","), function(i, name) {
				
			// configuration
			if ($.isFunction(conf[name]))  {
				self.bind(name, conf[name]);	
			}
			
			// API methods				
			self[name] = function(fn) {
				return self.bind(name, fn);	
			};
		});	
		
		// form validation
		var form = inputs.eq(0).closest("form");
		
		if (form.length) {
			form.bind(conf.events.form, function(e) {
				if (!self.checkValidity()) { 
					return e.preventDefault(); 
				}
			});
			
			// Web Forms 2.0 compatibility
			form[0].checkValidity = self.checkValidity;
		}
		
		// input validation
		if (conf.events.input) {
			inputs.bind(conf.events.input, function(e) {
				self.checkValidity($(this));
			});	
		}
		
	}


	// jQuery plugin initialization
	$.fn.validator = function(conf) {   
		
		// return existing instance
		var el = this.eq(typeof conf == 'number' ? conf : 0).data("validator");
		if (el) { return el; } 
		
		// configuration
		var globals = $.extend({}, v.conf); 
		conf = $.extend(true, globals, conf);		
		
		// selector is a form		
		if (this.is("form")) {
			this.each(function() {					
				var form = $(this);	
				el = new Validator(form.find(":input"), conf);				
				form.data("validator", el);
			});
			
		// input fields given directly
		} else {
			el = new Validator(this, conf);	
		}
		
		
		return conf.api ? el: this;		
	};   
		
})(jQuery);
			

