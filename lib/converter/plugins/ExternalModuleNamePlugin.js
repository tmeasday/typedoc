"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var components_1 = require('../components');
var converter_1 = require('../converter');
var CommentPlugin_1 = require('./CommentPlugin');
var abstract_1 = require('../../models/reflections/abstract');
var comment_1 = require('../factories/comment');
var ModuleAnnotationPlugin = (function (_super) {
    __extends(ModuleAnnotationPlugin, _super);
    function ModuleAnnotationPlugin() {
        _super.apply(this, arguments);
    }
    ModuleAnnotationPlugin.prototype.onBegin = function (context) {
        this.moduleRenames = [];
    };
    ModuleAnnotationPlugin.prototype.initialize = function () {
        this.listenTo(this.owner, (_a = {},
            _a[converter_1.Converter.EVENT_BEGIN] = this.onBegin,
            _a[converter_1.Converter.EVENT_CREATE_DECLARATION] = this.onDeclaration,
            _a[converter_1.Converter.EVENT_CREATE_SIGNATURE] = this.onDeclaration,
            _a[converter_1.Converter.EVENT_RESOLVE_BEGIN] = this.onBeginResolve,
            _a
        ));
        var _a;
    };
    ModuleAnnotationPlugin.prototype.onDeclaration = function (context, reflection, node) {
        if (!node)
            return;
        var rawComment = comment_1.getRawComment(node);
        if (!rawComment)
            return;
        if (reflection.kindOf(abstract_1.ReflectionKind.ExternalModule)) {
            var match = /@module\s+(\w+)/.exec(rawComment);
            if (match) {
                var preferred = /@preferred/.exec(rawComment);
                this.moduleRenames.push({
                    renameTo: match[1],
                    preferred: preferred != null,
                    reflection: reflection
                });
            }
        }
    };
    ModuleAnnotationPlugin.prototype.onBeginResolve = function (context) {
        var projRefs = context.project.reflections;
        var refsArray = Object.keys(projRefs)
            .reduce(function (m, k) {
            m.push(projRefs[k]);
            return m;
        }, []);
        this.moduleRenames.forEach(function (item) {
            var renaming = item.reflection;
            var mergeTarget = refsArray.filter(function (ref) { return ref.kind === renaming.kind && ref.name === item.renameTo; })[0];
            if (!mergeTarget) {
                renaming.name = item.renameTo;
                return;
            }
            var childrenOfRenamed = refsArray.filter(function (ref) { return ref.parent === renaming; });
            childrenOfRenamed.forEach(function (ref) {
                ref.parent = mergeTarget;
                mergeTarget.children.push(ref);
            });
            if (item.preferred) {
                mergeTarget.comment = renaming.comment;
            }
            if (renaming.children) {
                renaming.children.length = 0;
            }
            CommentPlugin_1.CommentPlugin.removeReflection(context.project, renaming);
            CommentPlugin_1.CommentPlugin.removeTags(mergeTarget.comment, "module");
            CommentPlugin_1.CommentPlugin.removeTags(mergeTarget.comment, "preferred");
        });
    };
    ModuleAnnotationPlugin = __decorate([
        components_1.Component({ name: 'module-annotation' })
    ], ModuleAnnotationPlugin);
    return ModuleAnnotationPlugin;
}(components_1.ConverterComponent));
exports.ModuleAnnotationPlugin = ModuleAnnotationPlugin;
//# sourceMappingURL=ExternalModuleNamePlugin.js.map