/**
 * HTML Uploader reporter
 */
export class UploadReporter {
    private fileIndex: number;
    private size: number;
    private files: { size: number; name: string }[] = [];

    constructor(private renderHtmlElement: HTMLElement) {
        this.fileIndex = 0;
    }

    public setup(files: { size: number; name: string }[]) {
        this.files = files;
    }

    private createBar(fileIndex: number) {
        const fileName = this.files[fileIndex].name;

        const info = `${fileIndex + 1}/${this.files.length} | {bar} {percentage}% | ${fileName} | {value} / {total}`
        console.log(info);
    }

    public update(fileIndex: number, written: number) {
        if (fileIndex !== this.fileIndex) {
            this.fileIndex = fileIndex;
            this.size = this.files[this.fileIndex].size;
            console.log("Strting new file: " + this.files[this.fileIndex].name);
            this.createBar(this.fileIndex);
        }

        // log uploaded percentage
        console.log("Progress: " + written + " bytes (" + (written / this.size) * 100 + "%)");
    }

    public start() {
        console.log("Start of flash\n");
    }

    public stop() {
        console.log("End of flash\n");
    }
}