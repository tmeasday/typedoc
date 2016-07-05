import { Component, ConverterComponent } from '../components';
import { Converter } from '../converter';
import { Context } from '../context';
import { CommentPlugin } from './CommentPlugin';
import { Reflection, ReflectionKind } from '../../models/reflections/abstract';
import { ContainerReflection } from '../../models/reflections/container';
import { getRawComment } from '../factories/comment';
import * as ts from "typescript";

interface ModuleRename {
  renameTo: string;
  preferred: boolean;
  reflection: ContainerReflection;
}

/**
 * This plugin allows an ES6 module to specify its TypeDoc name.
 * It also allows multiple ES6 modules to be merged together into a single TypeDoc module.
 *
 * @usage
 * At the top of an ES6 module, add a "dynamic module comment".  Insert "@module typedocModuleName"
 *   to specify that this ES6 module should be merged with module: "typedocModuleName".
 *
 * Similar to the [[DynamicModulePlugin]], ensure that there is a comment tag (even blank) for the
 * first symbol in the file.
 *
 * @example
 * ```
 *
 * &#47;**
 *  * @module newModuleName
 *  *&#47;
 * &#47;** for typedoc &#47;
 * import {foo} from "../foo";
 * export let bar = "bar";
 * ```
 *
 * Also similar to [[DynamicModulePlugin]], if @preferred is found in a dynamic module comment, the
 *   comment will be used as the module comment, and documentation will be generated from it (note:
 *   this plugin does not attempt to count lengths of merged module comments in order to guess the
 *   best one)
 */
@Component({name:'module-annotation'})
export class ModuleAnnotationPlugin extends ConverterComponent {
  /** List of module reflections which are models to rename */
  private moduleRenames: ModuleRename[];

  /**
   * Triggered when the converter begins converting a project.
   *
   * @param context  The context object describing the current state the converter is in.
   */
  private onBegin(context: Context) {
    this.moduleRenames = [];
  }

  /**
   * Create a new CommentPlugin instance.
   */
  initialize() {
    this.listenTo(this.owner, {
      [Converter.EVENT_BEGIN]:                   this.onBegin,
      [Converter.EVENT_CREATE_DECLARATION]:      this.onDeclaration,
      [Converter.EVENT_CREATE_SIGNATURE]:        this.onDeclaration,
      [Converter.EVENT_RESOLVE_BEGIN]:           this.onBeginResolve,
    });
  }

  /**
   * Triggered when the converter has created a declaration reflection.
   *
   * @param context  The context object describing the current state the converter is in.
   * @param reflection  The reflection that is currently processed.
   * @param node  The node that is currently processed if available.
   */
  private onDeclaration(context: Context, reflection: Reflection, node?: ts.Node) {
    if (!node) return;
    var rawComment = getRawComment(node);
    if (!rawComment) return;
    
    if (reflection.kindOf(ReflectionKind.ExternalModule) || true) {
      // Look for @module
      let match   = /@module\s+(\w+)/.exec(rawComment);
      if (match) {
        // Look for @preferred
        let preferred = /@preferred/.exec(rawComment);
        // Set up a list of renames operations to perform when the resolve phase starts
        this.moduleRenames.push({
          renameTo: match[1],
          preferred: preferred != null,
          reflection: <ContainerReflection> reflection
        });
      }
    }
  }

  /**
   * Triggered when the converter begins resolving a project.
   *
   * @param context  The context object describing the current state the converter is in.
   */
  private onBeginResolve(context: Context) {
    let projRefs                = context.project.reflections;
    let refsArray: Reflection[] = Object.keys(projRefs)
      .reduce((m, k) => {
        m.push(projRefs[k]);
        return m;
      }, []);

    // Process each rename
    this.moduleRenames.forEach(item => {
      let renaming    = <ContainerReflection> item.reflection;
      // Find an existing module that already has the "rename to" name.  Use it as the merge target.
      let mergeTarget = <ContainerReflection>
        refsArray.filter(ref => ref.kind === renaming.kind && ref.name === item.renameTo)[0];

      // If there wasn't a merge target, just change the name of the current module and exit.
      if (!mergeTarget) {
        renaming.name = item.renameTo;
        return;
      }

      // Since there is a merge target, relocate all the renaming module's children to the
      // mergeTarget.
      let childrenOfRenamed = refsArray.filter(ref => ref.parent === renaming);
      childrenOfRenamed.forEach((ref: Reflection) => {
        // update links in both directions
        ref.parent = mergeTarget;
        mergeTarget.children.push(<any> ref)
      });

      // If @preferred was found on the current item, update the mergeTarget's comment
      // with comment from the renaming module
      if (item.preferred) {
        mergeTarget.comment = renaming.comment;
      }

      // Now that all the children have been relocated to the mergeTarget, delete the empty module
      // Make sure the module being renamed doesn't have children, or they will be deleted
      if (renaming.children) {
        renaming.children.length = 0;
      }
      CommentPlugin.removeReflection(context.project, renaming);

      // Remove @module and @preferred from the comment, if found.
      CommentPlugin.removeTags(mergeTarget.comment, "module");
      CommentPlugin.removeTags(mergeTarget.comment, "preferred");
    });
  }
}



