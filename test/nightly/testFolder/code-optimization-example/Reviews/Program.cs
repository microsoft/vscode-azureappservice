using System.Globalization;
namespace Store.Reviews;
using Microsoft.Extensions.Logging;

internal class Program
{
    //private static readonly ILogger<Program>? _logger; // Add a private static ILogger field
        private static int Main(string[] args)
    {

        using ILoggerFactory factory = LoggerFactory.Create(builder => builder.AddConsole());

        var builder = WebApplication.CreateBuilder(args);
        builder.Services.AddHostedService<BackgroundReviewValidation>();

        var app = builder.Build();

        app.MapGet("/scrub", () =>
        {
            string x = Math.PI.ToString();
            ILogger logger = factory.CreateLogger("Main program /scrub");
            for (int i = 0; i < 1000; i++)
            {
                x = x + Random.Shared.Next(0, 10).ToString();
                if (i % 50 == 0)
                {
                    ReviewValidation.StringValidation("Working...", 'X', CultureInfo.CurrentCulture);
                    logger.LogInformation("Logging information...") ;
                }
            }

            return ReviewValidation.StringValidation($"PI is {x}", 'X', CultureInfo.CurrentCulture);
        });

        app.MapGet("/", () => "Hello World! V4 4/30/24");
        app.Run();

        return 0;
    }
}
