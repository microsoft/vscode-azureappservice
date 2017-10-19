export class UserCancelledError extends Error { }
export class GitNotInstalledError extends Error { }

export class LocalGitDeployError extends Error {
    public readonly name: string;
    public readonly message: string;
    public readonly servicePlanSize: string;
    constructor(error: Error, servicePlanSize: string) {
        super();
        this.name = error.constructor.name;
        this.message = error.message;
        this.servicePlanSize = servicePlanSize;
    }
}