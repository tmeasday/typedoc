import { ConverterComponent } from '../components';
export declare class ModuleAnnotationPlugin extends ConverterComponent {
    private moduleRenames;
    private onBegin(context);
    initialize(): void;
    private onDeclaration(context, reflection, node?);
    private onBeginResolve(context);
}
